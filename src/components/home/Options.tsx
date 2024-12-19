import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import React, {FC} from 'react';
import { optionStyles } from '../../styles/optionsStyles';
import Icon from '../global/Icon';
import { Colors } from '../../utils/Constants';
import CustomText from '../global/CustomText';
import { useTCP } from '../../services/TCPProvider';
import { navigate } from '../../utils/NavigationUtil';
import { pickImage } from '../../utils/libraryHelpers';

const Options: FC<{
  isHome?: boolean;
  onMediaPickedUp?: (media: any) => void;
  onFilePickedUp?: (file: any) => void;
}> = ({isHome, onMediaPickedUp, onFilePickedUp}) => {


  const {isConnected} = useTCP();

    const handleUniversalPicker = async(type:string)=>{
      if(isHome){
        if(isConnected){
          navigate('ConnectionScreen');
        }else{
          navigate('SendScreen');
        }
        return
      }

      if(type==='image' && onMediaPickedUp){
        pickImage(onMediaPickedUp);
      }
    }



  return (
    <View style={optionStyles.container}>
      <TouchableOpacity style={optionStyles.subContainer} onPress={()=>handleUniversalPicker('images')}>
        <Icon iconFamily='Ionicons' color={Colors.primary} size={20} name='image'/>
        <CustomText fontFamily='Okra-Medium' style={{
            marginTop:4, textAlign:'center'
        }}>Photo</CustomText>
      </TouchableOpacity>
      <TouchableOpacity style={optionStyles.subContainer} onPress={()=>handleUniversalPicker('file')}>
        <Icon iconFamily='Ionicons' color={Colors.primary} size={20} name='musical-notes-sharp'/>
        <CustomText fontFamily='Okra-Medium' style={{
            marginTop:4, textAlign:'center'
        }}>Audio</CustomText>
      </TouchableOpacity>
      <TouchableOpacity style={optionStyles.subContainer} onPress={()=>handleUniversalPicker('file')}>
        <Icon iconFamily='Ionicons' color={Colors.primary} size={20} name='folder-open'/>
        <CustomText fontFamily='Okra-Medium' style={{
            marginTop:4, textAlign:'center'
        }}>Files</CustomText>
      </TouchableOpacity>
      <TouchableOpacity style={optionStyles.subContainer} onPress={()=>handleUniversalPicker('file')}>
        <Icon iconFamily='MaterialCommunityIcons' color={Colors.primary} size={20} name='contacts'/>
        <CustomText fontFamily='Okra-Medium' style={{
            marginTop:4, textAlign:'center'
        }}>Contacts</CustomText>
      </TouchableOpacity>
    </View>
  );
};

export default Options;

const styles = StyleSheet.create({});
