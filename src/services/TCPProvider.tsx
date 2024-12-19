import {createContext, FC, useCallback, useContext, useState} from 'react';
import {useChunkStore} from '../db/chunkStorage';
import TcpSocket from 'react-native-tcp-socket';
import DeviceInfo from 'react-native-device-info';
import { Buffer } from 'buffer';
import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {v4 as uuidv4} from 'uuid';
import {produce} from 'immer';
import { receiveFileAck } from './TCPUtils';
interface TCPContextType {
  server: any;
  client: any;
  isConnected: boolean;
  connectedDevice: any;
  sentFiles: any;
  receviedFiles: any;
  totalSentBytes: number;
  totalReceivedBytes: number;
  startServer: (port: number) => void;
  connectToServer: (host: string, port: number, deviceName: string) => void;
  sendMessage: (message: string | Buffer) => void;
  sendFileAck: (file: any, type: 'file' | 'image') => void;
  disconnect: () => void;
}

const TCPContext = createContext<TCPContextType | undefined>(undefined);

export const useTCP = (): TCPContextType => {
  const context = useContext(TCPContext);
  if (!context) {
    throw new Error('useTCP must be used within a TCPProvider');
  }
  return context;
};

const options = {
  keystore: require('../../tls_certs/server-keystore.p12'),
};

export const TCPProvider: FC<{children: React.ReactNode}> = ({children}) => {
  const [server, setServer] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [sentFiles, setSentFiles] = useState<any>([]);
  const [receviedFiles, setReceviedFiles] = useState<any>([]);
  const [totalSentBytes, setTotalSentBytes] = useState<number>(0);
  const [totalReceivedBytes, setTotalReceivedBytes] = useState<number>(0);
  const [serverSocket, setServerSocket] = useState<any>(null);

  const {currentChunkSet, setCurrentChunkSet, setChunkStore} = useChunkStore();

  //START SERVER
  const startServer = useCallback(
    (port: number) => {
      if (server) {
        console.log('Server already running');
        return;
      }

      const newServer = TcpSocket.createTLSServer(options, socket => {
        console.log('Client connected', socket.address());
        setServerSocket(socket);
        socket.setNoDelay(true);
        socket.readableHighWaterMark = 1024 * 1024 * 1;
        socket.writableHighWaterMark = 1024 * 1024 * 1;

        socket.on('data', async data => {
          const parsedData = JSON.parse(data?.toString());
          if (parsedData?.event === 'connect') {
            setIsConnected(true);
            setConnectedDevice(parsedData?.deviceName);
          }

          if(parsedData?.event === 'file_ack'){
            receiveFileAck(parsedData?.file, socket, setReceviedFiles);
          }
        });

        socket.on('close', () => {
          console.log('Client disconnected');
          setReceviedFiles([]);
          setSentFiles([]);
          setCurrentChunkSet(null);
          setChunkStore(null);
          setTotalReceivedBytes(0);
          setIsConnected(false);
          disconnect();
        });

        socket.on('error', err => {
          console.log('Error occurred', err);
        });
      });

      newServer.listen({port, host: '0.0.0.0'}, () => {
        const address = newServer.address();
        console.log(`Server running on ${address?.address}:${address?.port}`);
      });

      newServer.on('error', err => {
        console.log('Error occurred', err);
      });

      setServer(newServer);
    },
    [server],
  );

  //START CLIENT
  const connectToServer = useCallback(
    (host: string, port: number, deviceName: string) => {
      const newClient = TcpSocket.connectTLS(
        {
          host,
          port,
          cert: true,
          ca: require('../../tls_certs/server-cert.pem'),
        },
        () => {
          setIsConnected(true);
          setConnectedDevice(deviceName);
          const myDeviceName = DeviceInfo.getDeviceNameSync();
          newClient.write(
            JSON.stringify({event: 'connect', deviceName: myDeviceName}),
          );
        },
      );

      newClient.setNoDelay(true);
      newClient.readableHighWaterMark = 1024 * 1024 * 1;
      newClient.writableHighWaterMark = 1024 * 1024 * 1;

      newClient.on('data', async(data)=>{
        const parsedData = JSON.parse(data?.toString());
        if(parsedData?.event === 'file_ack'){
          receiveFileAck(parsedData?.file, newClient, setReceviedFiles);
        }
      })

      newClient.on('close',()=>{
        console.log('Connection Closed');
        setReceviedFiles([])
        setSentFiles([])
        setCurrentChunkSet(null)
        setTotalReceivedBytes(0)
        setChunkStore(null)
        setIsConnected(false)
        disconnect();
      })

      newClient.on('error',(err)=>{
        console.error('Client Error occurred', err);

      })

      setClient(newClient);
    },
    [client],
  );

  // DISCONNECT

  const disconnect = useCallback(()=>{
    if(client){
      client.destroy();
    }
    if(server){
      server.close();
    }
    setReceviedFiles([]);
    setSentFiles([]);
    setCurrentChunkSet(null);
    setTotalReceivedBytes(0);
    setChunkStore(null);
    setIsConnected(false);
  },[client,server]);

  //SEND MESSAGE

  const sendMessage = useCallback((message:string | Buffer )=>{
    if(client){
      client.write(JSON.stringify(message));
      console.log('Sent from client', message);
    }else if(server){
      serverSocket.write(JSON.stringify(message));
      console.log('Sent from server', message);
    }else{
      console.error('No client or server connected');
    }


  },[client,server])

  const sendFileAck = async(file:any, type: 'image' | 'file')=>{
    if(currentChunkSet !=null){
      Alert.alert('Wait for current file to be sent');
      return;
    }

    const normalizedPath = Platform.OS === 'ios' ? file?.uri?.replace('file://',"") : file?.uri
    const fileData = await RNFS.readFile(normalizedPath, 'base64')
    const buffer = Buffer.from(fileData,'base64');
    const CHUNK_SIZE =1024 * 8;
    let totalChunks = 0;
    let offset= 0;
    let chunkArray = [];

    while(offset < buffer.length){
      const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
      totalChunks+=1;
      chunkArray.push(chunk);
      offset+=chunk.length;
    }

    const rawData = {
      id:uuidv4(),
      name: type === 'file' ? file?.name : file?.fileName,
      size: type === 'file' ? file?.size : file?.fileSize,
      mimeType: type === 'file' ? 'file' : '.jpg',
      totalChunks
    }

    setCurrentChunkSet({
      id: rawData.id,
      chunkArray,
      totalChunks
    })

    setSentFiles((prevData:any)=>
      produce(prevData,(draft:any)=>{
        draft.push({
          ...rawData,
          uri: file?.uri,
        })
      })
    )

    const socket =client || serverSocket;
    if(!socket){
      return;
    }

    try {
      console.log('FILE ACKNOWLEDGE DONE')
      socket.write(JSON.stringify({ event : 'file_ack', file: fileData}));
    } catch (error) {
      console.error(error);
    }
  }


  return (
    <TCPContext.Provider
      value={{
        server,
        client,
        isConnected,
        connectedDevice,
        sentFiles,
        receviedFiles,
        totalSentBytes,
        totalReceivedBytes,
        startServer,
        connectToServer,
        disconnect,
        sendMessage,
        sendFileAck
      }}>
      {children}
    </TCPContext.Provider>
  );
};
