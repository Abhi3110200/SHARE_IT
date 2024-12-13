import {createContext, FC, useCallback, useContext, useState} from 'react';
import {useChunkStore} from '../db/chunkStorage';
import TcpSocket from 'react-native-tcp-socket';
import DeviceInfo from 'react-native-device-info';
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
        });

        socket.on('close', () => {
          console.log('Client disconnected');
          setReceviedFiles([]);
          setSentFiles([]);
          setCurrentChunkSet(null);
          setChunkStore(null);
          setTotalReceivedBytes(0);
          setIsConnected(false);
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
    },
    [client],
  );

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
      }}>
      {children}
    </TCPContext.Provider>
  );
};
