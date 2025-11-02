import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useCallback, useRef, useEffect } from 'react';
import 'react-native-reanimated';
import { StyleSheet, View, Text, TextInput, Pressable } from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

SplashScreen.preventAutoHideAsync();
const specialKeyDelete = '⌫';
const specialKeyPlay = '▶';
const specialKeySpace = 'Espacio';

const keyboardLayout = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', specialKeyDelete],
  [specialKeySpace, specialKeyPlay]
];

const App: React.FC = () => {

  const [text, setText] = useState<string>('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDeletingRef = useRef(false);
  const textRef = useRef(text);
  const cursorPosRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const setupFullscreen = async () => {
      // Ocultar barra de navegación
      await NavigationBar.setVisibilityAsync('hidden');
      
      // Modo inmersivo sticky (se oculta automáticamente después de aparecer)
      await NavigationBar.setBehaviorAsync('inset-swipe');
      
      // Color de fondo transparente
      await NavigationBar.setBackgroundColorAsync('#00000000');
    };
    setupFullscreen();
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const isLetter = useCallback((key: string): boolean => {
    return /^[a-zñ]$/i.test(key);
  }, []);

  const GetKeyToAdd = useCallback((key: string): string => {
    if (isLetter(key)) {
      return key.toUpperCase();
    }
    return key;
  }, [isLetter]);

  const handleKeyPress = useCallback((key: string): void => {
    const start = cursorPosRef.current;
    const end = selection.end;
  
    const keyToAdd = GetKeyToAdd(key);
    const currentText = textRef.current;
  
    const newText = currentText.substring(0, start) + keyToAdd + currentText.substring(end);
    const newPosition = start + keyToAdd.length;
  
    textRef.current = newText;
    cursorPosRef.current = newPosition;
  
    setText(newText);
    setSelection({ start: newPosition, end: newPosition });
  }, [GetKeyToAdd, selection.end]);
  
  const handleSpace = useCallback((): void => {
    handleKeyPress(' ');
  }, [handleKeyPress]);

  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  };

  const speakText = useCallback(async (): Promise<void> => {
    if (isGenerating || !text) return;
    stopSpeech();

    setIsGenerating(true);
    try {
      Speech.speak(text, {
        language: 'es-ES',
        pitch: 1,
        rate: 1
      });

    } catch (error) {
      console.error("Text-to-speech failed:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [text]);

  const stopDeleting = () => {
    isDeletingRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const deleteCharOnce = () => {
    if (!isDeletingRef.current) return;

    const cursorPos = cursorPosRef.current;
    const currentText = textRef.current;

    if (cursorPos <= 0) {
      stopDeleting();
      return;
    }

    const newText = currentText.slice(0, cursorPos - 1) + currentText.slice(cursorPos);
    const newCursorPos = cursorPos - 1;
    
    cursorPosRef.current = newCursorPos;
    textRef.current = newText;
    
    setText(newText);
    setSelection({ start: newCursorPos, end: newCursorPos });
  };

  const startDeleting = () => {
    if (isDeletingRef.current) {
      stopDeleting();
      return;
    }
    
    isDeletingRef.current = true;
    textInputRef.current?.focus();

    cursorPosRef.current = selection.start;
    textRef.current = text;

    // Limpiar cualquier timer anterior
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    deleteCharOnce();

    timeoutRef.current = setTimeout(() => {
      if (!isDeletingRef.current) return;
      
      intervalRef.current = setInterval(() => {
        if (!isDeletingRef.current) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return;
        }
        deleteCharOnce();
      }, 50);
    }, 500);
  };

  const handleSelectionChange = (event: any) => {
    const newSelection = event.nativeEvent.selection;
    setSelection(newSelection);
    cursorPosRef.current = newSelection.start;
  };

  const handleBackspace = useCallback((): void => {
    stopDeleting();
    deleteCharOnce();
  }, [deleteCharOnce]);  

  const getStyleForKey = (key: string, pressed: boolean) => {
    switch (key) {
      case specialKeyDelete:
        return pressed ? [styles.deleteKey, styles.specialButtonPressed] : styles.deleteKey;
      case specialKeySpace:
        return pressed ? [styles.space, styles.specialButtonPressed] : styles.space;
      case specialKeyPlay:
        return pressed ? [styles.playButton, styles.specialButtonPressed] : styles.playButton;
      default:
        return pressed ? [styles.key, styles.buttonPressed] : styles.key;
    }
  }

  useEffect(() => {
    return () => {
      isDeletingRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);


  return (
    <View style={styles.globalContainer}>
      <StatusBar hidden={true} />
      <View style={styles.inputContainer}>
        <TextInput
          ref={textInputRef}
          style={styles.inputText}
          value={text}
          onChangeText={setText}
          onSelectionChange={handleSelectionChange}
          placeholder="Escribe aquí..."
          placeholderTextColor="#666"
          textAlignVertical="top"
          showSoftInputOnFocus={false}
          autoCapitalize='none'
          spellCheck={false}
        />
      </View>
      <View style={styles.keyboardContainer}>
        {keyboardLayout.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => (
              <Pressable
                id={key}
                key={key}
                style={({ pressed }) =>  [
                  getStyleForKey(key, pressed)
                ]}
                onPressIn={key === specialKeyDelete ? startDeleting : undefined}
                onPressOut={stopDeleting}
                onPress={
                  key === specialKeyDelete ? handleBackspace
                : key === specialKeySpace ? handleSpace
                : key === specialKeyPlay ? speakText
                : () => handleKeyPress(key)
                }
              >
                
                <Text
                  style={
                    key === specialKeyDelete ? styles.deleteKeyText :
                    key === specialKeySpace ? styles.spaceText :
                    key === specialKeyPlay ? styles.playButtonText :
                    styles.keyText
                  }
                >{key}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>    
  );
}

export default App;

const keyStyle = StyleSheet.create({
  key: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginHorizontal: 4,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  globalContainer: {
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
    margin: 0,
    backgroundColor: '#ffc0cb',
    paddingTop: 10,
  },
  inputContainer: {
    display: 'flex',
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 0,
    paddingHorizontal: 10,
    width: '98%',
  },
  keyboardContainer: {
    display: 'flex',  
    flex: 5,
    padding: 10,
    width: '98%',
  },
  inputText: {
    fontSize: 30,
    fontWeight: '900',
    backgroundColor: "white",
    borderRadius: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  key: {
    ...keyStyle.key
  },
  keyText: {
    fontSize: 25,
    fontWeight: '900',
    color: 'purple',
  },
  deleteKey: {
    ...keyStyle.key,
    backgroundColor: 'purple',
    minWidth: 120,
    alignItems: 'center',
  },
  deleteKeyText: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
  },
  space: {
    ...keyStyle.key,
    backgroundColor: 'purple',
    width: '80%',
    alignItems: 'center',
  },
  spaceText: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
  },
  playButton: {
    ...keyStyle.key,
    backgroundColor: "#3F183A",
    borderRadius: 10
  },
  playButtonText: {
    fontSize: 25,
    color: "#fff",
    fontWeight: "900",
  },
  buttonPressed: {
    backgroundColor: '#CBC3E3',
    borderColor: '#aaa',
  },
  specialButtonPressed: {
    opacity: 0.7,
  }
});
