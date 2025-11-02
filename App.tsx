import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StrictMode, useState, useCallback, useRef, useEffect } from 'react';
import 'react-native-reanimated';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as Speech from 'expo-speech';

SplashScreen.preventAutoHideAsync();

const keyboardLayout = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ['Espacio', '▶']
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
    textRef.current = text;
    SplashScreen.hideAsync();
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

  // Manejar presión de tecla
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
  
  // Manejar espacio
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

  // Reproducir texto
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

  useEffect(() => {
    return () => {
      isDeletingRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);


  return (
    <View style={styles.globalContainer}>
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
        />
      </View>
      <View style={styles.keyboardContainer}>
        {keyboardLayout.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={
                  key === '⌫' ? styles.deleteKey : 
                  key.toLocaleLowerCase() === "espacio" ? styles.space : 
                  key === '▶' ? styles.playButton : styles.key
                }
                onPressIn={key === '⌫' ? startDeleting : undefined}
                onPressOut={stopDeleting}
                onPress={
                  key === '⌫' ? handleBackspace
                : key.toLocaleLowerCase() === 'espacio' ? handleSpace
                : key === '▶' ? speakText
                : () => handleKeyPress(key)
                }
              >
                <Text
                  style={
                    key === '⌫' ? styles.deleteKeyText :
                    key.toLocaleLowerCase() === "espacio" ? styles.spaceText :
                    key === '▶' ? styles.playButtonText :
                    styles.keyText
                  }
                >{key}</Text>
              </TouchableOpacity>
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
    paddingTop: 20
  },
  globalContainer: {
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
    margin: 0,
    backgroundColor: '#ffc0cb',
  },
  inputContainer: {
    display: 'flex',
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginBottom: 5,
    width: '98%',
  },
  keyboardContainer: {
    display: 'flex',  
    flex: 5,
    padding: 10,
    width: '98%',
  },
  inputText: {
    fontSize: 35,
    fontWeight: '900',
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
});
