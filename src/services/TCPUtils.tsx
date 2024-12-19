import { produce } from "immer"
import { Alert } from "react-native"
import { useChunkStore } from "../db/chunkStorage"
import { Buffer } from "buffer"
import { resolve } from "path"

export const receiveFileAck = async(data:any, socket:any, setRecevideFiles:any)=>{
  const {setChunkStore,chunkStore}=useChunkStore.getState();
  if(chunkStore){
    Alert.alert("There are files whick need to b received Wait Bro!");
    return;
  }

  setRecevideFiles((prevData:any)=>{
    produce(prevData, (draft:any)=>{
      draft.push(data);
    })
  })

  setChunkStore({
    id:data?.id,
    totalChunks:data?.totalChunks,
    name: data?.name,
    size: data?.size,
    mimeType: data?.mimeType,
    chunkArray:[],
  })

  if(!socket){
    console.log("Socket not available");
    return;
  }

  try {
    await new Promise((resolve)=>setTimeout(resolve,10));
    console.log("FILE RECEIVED");
    socket.write(JSON.stringify({event:"send_chunk_ack",chunkNo:0}));
    console.log("REQUESTED FOR CHUNK FIRST")
    
  } catch (error) {
    console.log(error);
    
  }
}

export const sendChunkAck = async(chunkIndex:any, socket:any, setTotalSentBytes:any, setSentFiles:any)=>{
  const {currentChunkSet, resetCurrentChunkSet} = useChunkStore.getState();

  if(!currentChunkSet){
    Alert.alert('There are no chunks to be sent');
    return;
  }

  if(!socket){
    Alert.alert("Socket not available");
    return;
  }

  const totalChunks = currentChunkSet?.totalChunks;

  try {
    await new Promise((resolve)=>setTimeout(resolve,10));
    socket.write(JSON.stringify({
      event:"receive_chunk_ack",
      chunk: currentChunkSet?.chunkArray[chunkIndex].toString('base64'),
      chunkNo: chunkIndex,
    }))

    setTotalSentBytes((prev:number)=>prev+currentChunkSet.chunkArray[chunkIndex]?.length);

    if(chunkIndex + 2 > totalChunks){
      console.log("ALL CHUNKS SENT SUCCESSFULLY");
      setSentFiles((prevFiles:any)=>{
        produce(prevFiles, (draftFiles:any)=>{
          const fileIndex = draftFiles?.findIndex((f:any)=>f.id===currentChunkSet.id)
          if(fileIndex !== -1){
            draftFiles[fileIndex].available = true
          }
        })
      })

      resetCurrentChunkSet();
    }
  } catch (error) {
    console.log(error);
    
  }
}