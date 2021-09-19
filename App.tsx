/* eslint-disable react-native/no-inline-styles */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import RtcEngine, {
  RtcLocalView,
  RtcRemoteView,
  VideoRenderMode,
} from 'react-native-agora';
import { ErrorBoundary } from 'react-error-boundary';
import requestCameraAndAudioPermission from './components/Permission';
import styles from './components/Style';
import {
  AGORA_APP_ID,
  AGORA_APP_TOKEN,
  AGORA_CHANNEL_NAME,
} from 'react-native-dotenv';

interface Props {}

/**
 * @property peerIds Array for storing connected peers
 * @property appId
 * @property channelName Channel Name for the current session
 * @property joinSucceed State variable for storing success
 */
interface State {
  joinSucceed: boolean;
  peerIds: number[];
}

const position = new Animated.ValueXY({ x: 16, y: -150 });

const App: React.FC<Props> = ({}: Props) => {
  const _engine = useRef<RtcEngine>();
  const [joinSucceed, setJoinSucceed] = useState(false);
  const [peerIds, setPeerIds] = useState<Array<any>>([]);
  const [error, setError] = useState<any>({
    boolean: false,
    body: '',
    header: '',
    stay: false,
  });
  const animateOut = useCallback(() => {
    if (error.stay) return;
    Animated.timing(position, {
      toValue: { x: 16, y: -100 },
      delay: 6000,
      duration: 400,
      useNativeDriver: false,
    }).start(() =>
      setError({
        boolean: false,
        header: '',
        body: '',
      })
    );
  }, [error.stay]);
  const animateInto = useCallback(
    (object) => {
      setError(object);
      Animated.timing(position, {
        toValue: { x: 16, y: 60 },
        duration: 400,
        useNativeDriver: false,
      }).start(animateOut);
    },
    [animateOut]
  );
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Request required permissions from Android
      requestCameraAndAudioPermission().then(() => {
        console.log('requested!');
      });
    }
    const init = async () => {
      _engine.current = await RtcEngine.create(AGORA_APP_ID);
      await _engine?.current?.enableVideo();

      _engine?.current?.addListener('Warning', (warn) => {
        devLogger('Warning', JSON.stringify(warn).substring(0, 200));
        animateInto({
          boolean: true,
          header: 'Warning',
          body: JSON.stringify(warn).substring(0, 200),
          stay: false,
        });
      });

      _engine?.current?.addListener('Error', (err) => {
        devLogger('Error', JSON.stringify(err).substring(0, 200));
        animateInto({
          boolean: true,
          header: 'Error',
          body: JSON.stringify(err).substring(0, 200),
          stay: false,
        });
      });

      _engine?.current?.addListener('UserJoined', (uid, elapsed) => {
        console.log('UserJoined', uid, elapsed);
        // If new user
        if (peerIds.indexOf(uid) === -1) {
          setPeerIds([...peerIds, uid]);
        }
      });

      _engine?.current?.addListener('UserOffline', (uid, reason) => {
        console.log('UserOffline', uid, reason);
        setPeerIds(peerIds.filter((id) => id !== uid));
      });

      // If Local user joins RTC channel
      _engine?.current?.addListener(
        'JoinChannelSuccess',
        (channel, uid, elapsed) => {
          console.log('JoinChannelSuccess', channel, uid, elapsed);
          // Set state variable to true
          setJoinSucceed(true);
        }
      );
    };
    init();
  }, [animateInto, peerIds]);

  const cancel = () => {
    Animated.timing(position, {
      toValue: { x: 16, y: -150 },
      duration: 200,
      useNativeDriver: false,
    }).start(() =>
      setError({
        boolean: false,
        header: '',
        body: '',
      })
    );
  };
  const startCall = async () => {
    // Join Channel using null token and channel name
    await _engine?.current?.joinChannel(
      AGORA_APP_TOKEN,
      AGORA_CHANNEL_NAME,
      null,
      0
    );
  };

  const endCall = async () => {
    await _engine?.current?.leaveChannel();
    setPeerIds([]);
    setJoinSucceed(false);
  };

  const devLogger = (type: string, string: string) => {
    console.log(
      `${type.toUpperCase()}: `,
      `${new Date().toISOString()} [${string}]`
    );
  };

  const _renderVideos = () => {
    return joinSucceed ? (
      <View style={styles.fullView}>
        <RtcLocalView.SurfaceView
          style={styles.max}
          channelId={AGORA_CHANNEL_NAME}
          renderMode={VideoRenderMode.Hidden}
        />
        {_renderRemoteVideos()}
      </View>
    ) : null;
  };

  const _renderRemoteVideos = () => {
    return (
      <ScrollView
        style={styles.remoteContainer}
        contentContainerStyle={{ paddingHorizontal: 2.5 }}
        horizontal={true}
      >
        {peerIds.map((value) => {
          return (
            <RtcRemoteView.SurfaceView
              style={styles.remote}
              uid={value}
              channelId={AGORA_CHANNEL_NAME}
              renderMode={VideoRenderMode.Hidden}
              zOrderMediaOverlay={true}
            />
          );
        })}
      </ScrollView>
    );
  };

  return (
    <ErrorBoundary
      fallbackRender={(props) => {
        const { resetErrorBoundary } = props;
        const err = props.error;
        return (
          <View
            style={{
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                alignSelf: 'center',
                fontSize: 21,
                fontWeight: 'bold',
              }}
            >
              Oh no
            </Text>
            <Text
              style={{
                textAlign: 'center',
                alignSelf: 'center',
                marginVertical: 21,
              }}
            >
              {err.message}
            </Text>
            <TouchableOpacity
              style={[styles.button, { alignSelf: 'center' }]}
              onPress={() => {
                // this next line is why the fallbackRender is useful
                // resetComponentState()
                // though you could accomplish this with a combination
                // of the FallbackCallback and onReset props as well.
                resetErrorBoundary();
              }}
            >
              <Text style={styles.buttonText}>{'Try again'}</Text>
            </TouchableOpacity>
          </View>
        );
      }}
      onError={(e, info) => {
        console.log(e, info);
        setError({
          boolean: true,
          header: 'Error',
          body: e.message.substring(0, 200),
          stay: false,
        });
      }}
    >
      <View style={styles.max}>
        <Animated.View
          style={{
            alignSelf: 'flex-end',
            flexDirection: 'row',
            justifyContent: 'space-between',
            backgroundColor: error.header === 'Warning' ? 'gold' : 'red',
            paddingHorizontal: 16,
            paddingVertical: 11,
            borderRadius: 8,
            position: 'absolute',
            top: position.y,
            right: position.x,
            left: position.x,
            zIndex: 999,
          }}
        >
          <View
            style={{
              justifyContent: 'space-between',
              flex: 0.95,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: '#FFF',
                paddingBottom: 5,
              }}
            >
              {error.header ? error.header : ''}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: '#FFF',
              }}
            >
              {error.body ? error.body : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Animated.timing(position, {
                toValue: { x: 16, y: -100 },
                delay: 0,
                duration: 200,
                useNativeDriver: false,
              }).start(() =>
                setError({
                  boolean: false,
                  header: '',
                  body: '',
                })
              );
            }}
          >
            <Text
              style={{ color: '#FFF', fontSize: 32, fontWeight: 'bold' }}
              onPress={cancel}
            >
              X
            </Text>
          </TouchableOpacity>
        </Animated.View>
        <View style={styles.max}>
          <View style={styles.buttonHolder}>
            <TouchableOpacity onPress={startCall} style={styles.button}>
              <Text style={styles.buttonText}> Start Call </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={endCall} style={styles.button}>
              <Text style={styles.buttonText}> End Call </Text>
            </TouchableOpacity>
          </View>
          {_renderVideos()}
        </View>
      </View>
    </ErrorBoundary>
  );
};

export default App;
