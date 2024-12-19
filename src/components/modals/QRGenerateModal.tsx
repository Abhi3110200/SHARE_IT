import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import React, {FC, useEffect, useMemo, useState} from 'react';
import {modalStyles} from '../../styles/modalStyles';
import Icon from '../global/Icon';
import CustomText from '../global/CustomText';
import {Camera, CodeScanner, useCameraDevice} from 'react-native-vision-camera';
import QRCode from 'react-native-qrcode-svg';
import Animated, {
  useSharedValue,
  Easing,
  useAnimatedStyle,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { multiColor } from '../../utils/Constants';
import DeviceInfo from 'react-native-device-info';
import { useTCP } from '../../services/TCPProvider';
import { navigate } from '../../utils/NavigationUtil';
import { getLocalIPAddress } from '../../utils/networkUtils';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
}

const QRGenerateModal: FC<ModalProps> = ({visible, onClose}) => {
  const [loading, setLoading] = useState(true);
  const {isConnected, server, startServer} = useTCP();

  const [qrValue, setQRValue] = useState('Abhijeet');
  const shimmerTranslateX = useSharedValue(-300);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{translateX: shimmerTranslateX.value}],
  }));


  const setUpServer = async()=>{
    const deviceName = await DeviceInfo.getDeviceName();
    if(server){
      const ip =await getLocalIPAddress();
      const port = 4000;
      setQRValue(`tcp://${ip}:${port}|${deviceName}`);
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  useEffect(() => {
    shimmerTranslateX.value = withRepeat(
      withTiming(-300, {duration: 1500, easing: Easing.linear}),
      -1,
      false,
    );

    if(visible){
        setLoading(true);
        setUpServer();
    }
  }, [visible]);

  useEffect(()=>{
    console.log("TCP Provider")
    if(isConnected){
      onClose();
      navigate('ConnectionScreen');
    }

  },[isConnected])

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="formSheet"
      onDismiss={onClose}>
      <View style={modalStyles.modalContainer}>
        <View style={modalStyles.qrContainer}>
          {loading || qrValue == null || qrValue == '' ? (
            <View style={modalStyles.skeleton}>
              <Animated.View style={[modalStyles.shimmerOverlay, shimmerStyle]}>
                <LinearGradient
                  colors={['#f3f3f3', '#fff', '#f3f3f3']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={modalStyles.shimmerGradient}
                />
              </Animated.View>
            </View>
          ) : (
            <QRCode
              value={qrValue}
              size={250}
              logoSize={60}
              logoBackgroundColor="#fff"
              logoMargin={2}
              logoBorderRadius={10}
              logo={require('../../assets/images/profile.jpg')}
              linearGradient={multiColor}
              enableLinearGradient
            />
          )}
        </View>

        <View style={modalStyles.info}>
          <CustomText style={modalStyles.infoText1}>
            Ensure you're on the same Wi-Fi network.
          </CustomText>
          <CustomText style={modalStyles.infoText2}>
            Ask the sender to scan this QR code to connect and transfer files.
          </CustomText>
        </View>

        <ActivityIndicator
          size="small"
          color="#000"
          style={{
            alignSelf: 'center',
          }}
        />
        <TouchableOpacity
          style={modalStyles.closeButton}
          onPress={() => onClose()}>
          <Icon name="close" iconFamily="Ionicons" size={24} color="#000" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default QRGenerateModal;
