import React, { useState, useRef } from 'react';

function App() {
  // State for all sections
  const [carrierImageUrl, setCarrierImageUrl] = useState('');
  const [carrierImageDimensions, setCarrierImageDimensions] = useState({ width: 0, height: 0 });
  const [editTextContent, setEditTextContent] = useState('');
  const [fileToHideContent, setFileToHideContent] = useState('');
  const [fileToHideName, setFileToHideName] = useState('');
  const [fileToHideType, setFileToHideType] = useState('');
  const [fileToHideUrl, setFileToHideUrl] = useState('');
  const [extractedData, setExtractedData] = useState('');
  const [extractedImageUrl, setExtractedImageUrl] = useState('');
  const [extractedHiddenFileUrl, setExtractedHiddenFileUrl] = useState('');
  const [extractedHiddenFileName, setExtractedHiddenFileName] = useState('');
  const [extractedHiddenFileType, setExtractedHiddenFileType] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [stegoImageUrl, setStegoImageUrl] = useState(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  
  // Activity Log
  const [activityLog, setActivityLog] = useState([]);
  
  // Crypto Modal State for Encrypt/Decrypt Text
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [cryptoMode, setCryptoMode] = useState('encrypt');
  const [passPhrase, setPassPhrase] = useState('');
  const [confirmPassPhrase, setConfirmPassPhrase] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hidePassword, setHidePassword] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  
  // Password Safe Modal State
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [safePassPhrase, setSafePassPhrase] = useState('');
  const [safeErrorMessage, setSafeErrorMessage] = useState('');
  
  // Extract Password Modal
  const [showExtractPasswordModal, setShowExtractPasswordModal] = useState(false);
  const [extractPassword, setExtractPassword] = useState('');
  const [extractErrorMessage, setExtractErrorMessage] = useState('');
  const [pendingExtractedRawData, setPendingExtractedRawData] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);
  
  const fileInputRef = useRef(null);
  const stegoFileInputRef = useRef(null);

  const purple = '#a855f7';
  const pink = '#ec4899';

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => {
      const updated = [{ timestamp, message, type }, ...prev];
      // Keep only last 50 logs to prevent memory leaks
      return updated.slice(0, 50);
    });
  };

  const getPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const getMaxCharacters = (width, height) => {
    return Math.floor((width * height) / 16) - 10;
  };

  const encryptText = (text, password) => {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const passwordBytes = encoder.encode(password);
    
    const encryptedBytes = new Uint8Array(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
      encryptedBytes[i] = textBytes[i] ^ passwordBytes[i % passwordBytes.length];
    }
    
    let binaryString = '';
    for (let i = 0; i < encryptedBytes.length; i++) {
      binaryString += String.fromCharCode(encryptedBytes[i]);
    }
    return btoa(binaryString);
  };

  const decryptText = (encryptedBase64, password) => {
    try {
      const binaryString = atob(encryptedBase64);
      const encryptedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        encryptedBytes[i] = binaryString.charCodeAt(i);
      }
      
      const encoder = new TextEncoder();
      const passwordBytes = encoder.encode(password);
      const decryptedBytes = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ passwordBytes[i % passwordBytes.length];
      }
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBytes);
    } catch (error) {
      return null;
    }
  };

  const textToBinary = (text) => {
    let binary = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      binary += charCode.toString(2).padStart(16, '0');
    }
    return binary + '0000000000000000';
  };

  const binaryToText = (binary) => {
    let text = '';
    for (let i = 0; i < binary.length; i += 16) {
      const chunk = binary.substring(i, i + 16);
      if (chunk === '0000000000000000') break;
      const charCode = parseInt(chunk, 2);
      if (charCode !== 0) text += String.fromCharCode(charCode);
    }
    return text;
  };

  const hideDataInImage = (imageData, secretText) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageDataObj.data;

        // Embed 1 bit per pixel (LSB of red channel). Store payload length (in bits)
        // so extraction doesn't rely on a sentinel that may appear inside the payload.
        const payloadBinary = textToBinary(secretText);
        const payloadBitLength = payloadBinary.length;

        // 32-bit header for payload length
        const headerBinary = payloadBitLength.toString(2).padStart(32, '0');
        const binaryToEmbed = headerBinary + payloadBinary;

        const availableBits = Math.floor(pixels.length / 4); // one bit per pixel
        if (binaryToEmbed.length > availableBits) {
          reject(new Error(`Secret too large for this image!`));
          return;
        }

        for (let i = 0; i < binaryToEmbed.length; i++) {
          const bit = binaryToEmbed[i] === '1' ? 1 : 0;
          pixels[i * 4] = (pixels[i * 4] & 0xFE) | bit;
        }

        ctx.putImageData(imageDataObj, 0, 0);
        resolve({ stegoImageUrl: canvas.toDataURL() });
      };
      img.onerror = reject;
      img.src = imageData;
    });
  };

  const extractDataFromImage = (imageData) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageDataObj.data;

        // Read 32-bit payload length header
        let headerBits = '';
        const maxPixels = Math.min(pixels.length / 4, 200000); // safety cap
        for (let i = 0; i < maxPixels && headerBits.length < 32; i++) {
          headerBits += (pixels[i * 4] & 1).toString();
        }

        if (headerBits.length < 32) {
          resolve('');
          return;
        }

        const payloadBitLength = parseInt(headerBits, 2);
        if (!Number.isFinite(payloadBitLength) || payloadBitLength <= 0) {
          resolve('');
          return;
        }

        // Now read exactly payloadBitLength bits right after the header
        let payloadBits = '';
        for (let i = 32; i < 32 + payloadBitLength; i++) {
          const pixelIndex = i; // one bit per pixel
          if (pixelIndex >= maxPixels) break;
          payloadBits += (pixels[pixelIndex * 4] & 1).toString();
        }

        const secret = binaryToText(payloadBits);
        resolve(secret);
      };
      img.onerror = reject;
      img.src = imageData;
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const processImageFile = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setCarrierImageDimensions({ width: img.width, height: img.height });
        setCarrierImageUrl(ev.target.result);
        addLog(`Image loaded: ${file.name}`, 'success');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectFileToHide = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileToHideName(file.name);
      setFileToHideType(file.type);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFileToHideContent(ev.target.result);
        setFileToHideUrl(ev.target.result);
        addLog(`File loaded: ${file.name}`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenTextFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditTextContent(ev.target.result);
        setIsEncrypted(false);
        addLog(`Text file opened: ${file.name}`, 'success');
      };
      reader.readAsText(file);
    }
  };

  const handleSaveTextFile = () => {
    if (!editTextContent) {
      alert('Nothing to save');
      return;
    }
    const blob = new Blob([editTextContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saved_text.txt';
    a.click();
    URL.revokeObjectURL(url);
    addLog('Text saved to file', 'success');
  };

  const openEncryptModal = () => {
    if (!editTextContent) {
      alert('No text to encrypt');
      return;
    }
    setCryptoMode('encrypt');
    setPassPhrase('');
    setConfirmPassPhrase('');
    setErrorMessage('');
    setHidePassword(false);
    setShowStrength(false);
    setShowCryptoModal(true);
  };

  const openDecryptModal = () => {
    if (!editTextContent) {
      alert('No text to decrypt');
      return;
    }
    setCryptoMode('decrypt');
    setPassPhrase('');
    setConfirmPassPhrase('');
    setErrorMessage('');
    setHidePassword(false);
    setShowStrength(false);
    setShowCryptoModal(true);
  };

  const openSafeModal = () => {
    setSafePassPhrase('');
    setSafeErrorMessage('');
    setShowSafeModal(true);
  };

  const handleSafeOk = () => {
    if (!safePassPhrase) {
      setSafeErrorMessage('Pass Phrase Required');
      return;
    }
    if (safePassPhrase.length < 6) {
      setSafeErrorMessage('Pass phrase must be at least 6 characters');
      return;
    }
    addLog('Password Safe accessed successfully', 'success');
    alert('✓ Password Safe accessed!');
    setShowSafeModal(false);
    setSafePassPhrase('');
  };

  const handleCryptoAction = () => {
    if (!passPhrase) {
      setErrorMessage('Pass Phrase Required');
      return;
    }
    
    if (passPhrase.length < 6) {
      setErrorMessage('Pass phrase must be at least 6 characters');
      return;
    }
    
    if (cryptoMode === 'encrypt' && passPhrase !== confirmPassPhrase) {
      setErrorMessage('Pass phrases do not match');
      return;
    }
    
    if (cryptoMode === 'encrypt') {
      const encrypted = encryptText(editTextContent, passPhrase);
      setEditTextContent(encrypted);
      setIsEncrypted(true);
      addLog(`Text encrypted successfully`, 'success');
      alert('✓ Text encrypted successfully!');
    } else if (cryptoMode === 'decrypt') {
      const decrypted = decryptText(editTextContent, passPhrase);
      if (decrypted) {
        setEditTextContent(decrypted);
        setIsEncrypted(false);
        addLog('Text decrypted successfully', 'success');
        alert('✓ Text decrypted successfully!');
      } else {
        setErrorMessage('Decryption failed - wrong pass phrase');
        return;
      }
    }
    
    setShowCryptoModal(false);
    setPassPhrase('');
    setConfirmPassPhrase('');
  };

  const useDefaultPassphrase = () => {
    setPassPhrase('default123');
    setConfirmPassPhrase('default123');
    setErrorMessage('');
  };

  const handleHideDataInCarrier = async () => {
    if (!carrierImageUrl) {
      alert('Please load an image carrier first');
      return;
    }
    
    let payload = {};
    
    if (editTextContent) {
      payload.text = editTextContent;
      payload.textIsEncrypted = isEncrypted;
    }
    
    if (fileToHideContent) {
      payload.file = {
        name: fileToHideName,
        type: fileToHideType,
        data: fileToHideContent
      };
    }
    
    if (Object.keys(payload).length === 0) {
      alert('Please enter text OR select a file to hide');
      return;
    }
    
    const finalSecret = JSON.stringify(payload);
    const maxChars = getMaxCharacters(carrierImageDimensions.width, carrierImageDimensions.height);
    
    if (finalSecret.length > maxChars) {
      alert(`Secret too large! Max ${maxChars} chars`);
      return;
    }
    
    try {
      const result = await hideDataInImage(carrierImageUrl, finalSecret);
      setStegoImageUrl(result.stegoImageUrl);
      addLog(`Data hidden successfully!`, 'success');
      alert('✓ Data hidden successfully!');
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      alert(`Error: ${error.message}`);
    }
  };

  const handleSendStegoByEmail = () => {
    if (!stegoImageUrl) {
      alert('No stego image available');
      return;
    }

    // Note: browsers do not allow attaching arbitrary in-memory/data URLs directly
    // via mailto:. The user must attach the downloaded stego_image.png manually.
    const subject = encodeURIComponent('Stego image (CYBERNESCENCE)');
    const body = encodeURIComponent(
      'Hi,\n\nHere is the stego image I generated.\n\n' +
      'Please attach the downloaded file: stego_image.png\n\n' +
      'Thank you!'
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    addLog('Email client opened (attach stego_image.png manually)', 'info');
  };

  const handleDownloadStegoImage = () => {
    if (!stegoImageUrl) {
      alert('No stego image available');
      return;
    }
    const link = document.createElement('a');
    link.download = 'stego_image.png';
    link.href = stegoImageUrl;
    link.click();
    addLog('Stego image downloaded', 'success');
  };

  const handleExtractDataFromCarrier = () => {
    const fileInput = stegoFileInputRef.current;
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('Please select a stego image file first');
      return;
    }
    
    const file = fileInput.files[0];
    addLog(`Extracting from: ${file.name}`, 'info');
    
    const previewReader = new FileReader();
    previewReader.onload = (e) => {
      setExtractedImageUrl(e.target.result);
    };
    previewReader.readAsDataURL(file);
    
    const extractReader = new FileReader();
    extractReader.onload = (e) => {
      setTimeout(async () => {
        try {
          addLog('Extracting hidden data...', 'info');
          const extractedText = await extractDataFromImage(e.target.result);
          
          if (!extractedText || extractedText.length === 0) {
            alert('No hidden data found');
            return;
          }
          
          try {
            const payload = JSON.parse(extractedText);
            
            if (payload.text && payload.textIsEncrypted === true) {
              setPendingPayload(payload);
              setPendingExtractedRawData(payload.text);
              setShowExtractPasswordModal(true);
              addLog('Encrypted text detected', 'info');
            } else {
              let displayText = payload.text ? `📝 Text:\n${payload.text}\n\n` : '📝 No text\n\n';
              if (payload.file) {
                displayText += `📎 File: ${payload.file.name}\n`;
                setExtractedHiddenFileUrl(payload.file.data);
                setExtractedHiddenFileName(payload.file.name);
                setExtractedHiddenFileType(payload.file.type);
              }
              setExtractedData(displayText);
              addLog('Extraction successful', 'success');
              alert('✓ Data extracted successfully!');
            }
          } catch (err) {
            setExtractedData(extractedText);
            addLog('Extracted as plain text', 'success');
            alert('✓ Data extracted as plain text!');
          }
        } catch (err) {
          alert(`Extraction failed: ${err.message}`);
          addLog(`Extraction failed: ${err.message}`, 'error');
        }
      }, 100);
    };
    extractReader.readAsDataURL(file);
  };

  const handleExtractWithPassword = () => {
    if (!extractPassword || extractPassword.length < 6) {
      setExtractErrorMessage('Password must be at least 6 characters');
      return;
    }
    
    addLog('Decrypting...', 'info');
    const decryptedText = decryptText(pendingExtractedRawData, extractPassword);
    
    if (decryptedText && !decryptedText.includes('�') && decryptedText.length > 0) {
      let displayText = `📝 Decrypted Text:\n${decryptedText}\n\n`;
      if (pendingPayload && pendingPayload.file) {
        displayText += `📎 File: ${pendingPayload.file.name}\n`;
        setExtractedHiddenFileUrl(pendingPayload.file.data);
        setExtractedHiddenFileName(pendingPayload.file.name);
        setExtractedHiddenFileType(pendingPayload.file.type);
      }
      setExtractedData(displayText);
      addLog('Decryption successful', 'success');
      alert('✓ Text decrypted successfully!');
      setShowExtractPasswordModal(false);
      setExtractPassword('');
      setExtractErrorMessage('');
      setPendingPayload(null);
      setPendingExtractedRawData('');
    } else {
      setExtractErrorMessage('Wrong password!');
      addLog('Wrong password', 'error');
    }
  };

  const handleCopyEditText = () => {
    if (!editTextContent) return;
    navigator.clipboard.writeText(editTextContent);
    addLog('Text copied', 'info');
  };

  const handlePasteEditText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setEditTextContent(text);
      setIsEncrypted(false);
      addLog('Text pasted', 'info');
    } catch (error) {
      addLog('Clipboard access denied', 'error');
      alert('Unable to read clipboard. Please paste manually.');
    }
  };

  const handleClearEditText = () => {
    setEditTextContent('');
    setIsEncrypted(false);
    addLog('Text cleared', 'info');
  };

  const handlePurgeFile = () => {
    setFileToHideContent('');
    setFileToHideName('');
    setFileToHideType('');
    setFileToHideUrl('');
    addLog('File purged', 'info');
  };

  const handleRemoveAllData = () => {
    setFileToHideContent('');
    setFileToHideName('');
    setFileToHideType('');
    setFileToHideUrl('');
    setEditTextContent('');
    setIsEncrypted(false);
    addLog('All data removed', 'info');
  };

  const openHelp = () => {
    alert('Steganography System\n\nTO HIDE:\n1. Load carrier image\n2. Type text and click "Encrypt Text" (optional)\n3. Select a file to hide (optional)\n4. Click "Hide Data in Image"\n5. Download stego image\n\nTO EXTRACT:\n1. Select stego image\n2. Click "Get Data"\n3. If text was encrypted, enter password\n4. See decrypted text and hidden file!');
  };

  const blackButton = {
    background: '#1f2937',
    color: 'white',
    border: '1px solid #374151',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  };

  const coloredButton = {
    background: `linear-gradient(135deg, ${purple}, ${pink})`,
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
  };

  const getStrengthText = () => {
    const score = getPasswordStrength(passPhrase);
    if (score === 0) return '0';
    if (score <= 2) return '1';
    if (score <= 4) return '2';
    return '3';
  };

  const totalSecretChars = (editTextContent?.length || 0) + (fileToHideContent?.length || 0);
  const maxCapacity = getMaxCharacters(carrierImageDimensions.width, carrierImageDimensions.height);
  const isOverCapacity = carrierImageDimensions.width > 0 && totalSecretChars > maxCapacity;

  const isHiddenFileImage = extractedHiddenFileType && extractedHiddenFileType.startsWith('image/');
  const isHiddenFileAudio = extractedHiddenFileType && extractedHiddenFileType.startsWith('audio/');
  const isHiddenFileVideo = extractedHiddenFileType && extractedHiddenFileType.startsWith('video/');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #0f0c29 100%)',
      padding: '20px',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    }}>
      <div style={{
        maxWidth: '1300px',
        margin: '0 auto',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(15px)',
        borderRadius: '20px',
        padding: '25px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        border: `1px solid ${purple}30`
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h1 style={{ 
            fontSize: '42px', 
            background: `linear-gradient(135deg, ${purple}, ${pink})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '5px',
            letterSpacing: '2px'
          }}>
            CYBERNESCENCE
          </h1>
          <p style={{ color: '#aaa', fontSize: '12px', letterSpacing: '1px' }}>SOFTWARE SOLUTIONS</p>
          <p style={{ color: '#666', fontSize: '11px', fontStyle: 'italic', marginTop: '5px' }}>bebe</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* LEFT COLUMN */}
          <div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>Picture or Sound File Carrier</h3>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !carrierImageUrl && fileInputRef.current.click()}
                style={{
                  background: isDragOver ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: `2px dashed ${isDragOver ? purple : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: '10px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: carrierImageUrl ? 'default' : 'pointer',
                  minHeight: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                
                {carrierImageUrl ? (
                  <div style={{ width: '100%' }}>
                    <img src={carrierImageUrl} alt="Carrier" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '8px' }} />
                    <button onClick={(e) => { e.stopPropagation(); setCarrierImageUrl(null); setCarrierImageDimensions({ width: 0, height: 0 }); }} style={blackButton}>Remove</button>
                  </div>
                ) : (
                  <div><div style={{ fontSize: '40px' }}>📁</div><div style={{ color: purple }}>+ Drag & Drop or Click</div></div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <label style={blackButton}>Open File<input type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} /></label>
                {carrierImageUrl && <button style={blackButton} onClick={() => navigator.clipboard.writeText(carrierImageUrl)}>Copy File</button>}
              </div>
              
              {carrierImageDimensions.width > 0 && (
                <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                  <p style={{ color: '#aaa', fontSize: '11px' }}>📐 {carrierImageDimensions.width} x {carrierImageDimensions.height} px</p>
                  <p style={{ color: '#aaa', fontSize: '11px' }}>💾 Max capacity: ~{maxCapacity} characters</p>
                </div>
              )}
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginTop: '20px'
            }}>
              <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>Steganography</h3>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <button style={coloredButton} onClick={handleHideDataInCarrier}>Hide Data in Image</button>
                <button style={{...coloredButton, background: `linear-gradient(135deg, ${pink}, ${purple})`}} onClick={handleExtractDataFromCarrier}>Get Data</button>
              </div>
              
              <div style={{ marginTop: '10px' }}>
                <p style={{ color: '#aaa', fontSize: '11px', marginBottom: '5px' }}>Select Stego Image to Extract:</p>
                <input 
                  ref={stegoFileInputRef} 
                  type="file" 
                  accept="image/*" 
                  style={{ 
                    background: 'rgba(0,0,0,0.3)', 
                    color: 'white', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    width: '100%',
                    border: `1px solid ${purple}40`,
                    cursor: 'pointer'
                  }} 
                />
              </div>
              
              {isOverCapacity && (
                <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>⚠️ Secret exceeds image capacity!</p>
              )}
              
              {stegoImageUrl && (
                <div style={{ marginTop: '15px', textAlign: 'center', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button style={coloredButton} onClick={handleDownloadStegoImage}>
                    Download Stego Image
                  </button>
                  <button style={blackButton} onClick={handleSendStegoByEmail}>
                    Send by Email
                  </button>
                </div>
              )}
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginTop: '20px'
            }}>
              <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>Text File</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={blackButton}>Open Text<input type="file" accept=".txt" onChange={handleOpenTextFile} style={{ display: 'none' }} /></label>
                <button style={blackButton} onClick={handleSaveTextFile}>Save Text</button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>Edit Text</h3>
              <textarea 
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${purple}40`, borderRadius: '10px', padding: '15px', color: 'white', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical', minHeight: '180px' }}
                value={editTextContent}
                onChange={(e) => { setEditTextContent(e.target.value); setIsEncrypted(false); }}
                placeholder="Type or paste text here..."
              />
              {isEncrypted && (
                <div style={{ marginTop: '8px', padding: '5px 10px', background: 'rgba(74,222,128,0.2)', borderRadius: '8px', border: '1px solid #4ade80' }}>
                  <span style={{ color: '#4ade80', fontSize: '11px' }}>🔒 This text is encrypted</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button style={blackButton} onClick={handleCopyEditText}>Copy</button>
                <button style={blackButton} onClick={handlePasteEditText}>Paste</button>
                <button style={blackButton} onClick={handleClearEditText}>Clear</button>
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginTop: '20px'
            }}>
              <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>Cryptography</h3>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button style={coloredButton} onClick={openEncryptModal}>Encrypt Text</button>
                <button style={{...coloredButton, background: `linear-gradient(135deg, ${pink}, ${purple})`}} onClick={openDecryptModal}>Decrypt Text</button>
              </div>
              <p style={{ color: '#666', fontSize: '10px', marginTop: '8px' }}>🔐 Only the text above is encrypted.</p>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginTop: '20px'
            }}>
              <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>File to Hide</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={blackButton} onClick={handlePurgeFile}>Purge</button>
                <label style={blackButton}>Select File<input type="file" onChange={handleSelectFileToHide} style={{ display: 'none' }} /></label>
                <button style={blackButton} onClick={handleRemoveAllData}>Remove Data</button>
              </div>
              {fileToHideName && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ color: pink, fontSize: '11px' }}>📎 File selected: {fileToHideName}</p>
                  {fileToHideType && fileToHideType.startsWith('image/') && (
                    <img src={fileToHideUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '8px', marginTop: '8px' }} />
                  )}
                </div>
              )}
              <p style={{ color: '#fbbf24', fontSize: '10px', marginTop: '8px' }}>📌 Files are NOT encrypted, only hidden.</p>
            </div>
          </div>
        </div>

        {/* EXTRACTED RESULTS */}
        {(extractedImageUrl || extractedData || extractedHiddenFileUrl) && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '15px',
            padding: '20px',
            border: `2px solid ${pink}`,
            marginTop: '20px'
          }}>
            <h3 style={{ color: pink, marginBottom: '15px', borderLeft: `3px solid ${pink}`, paddingLeft: '10px' }}>🔓 Extracted Results</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4 style={{ color: purple }}>📷 Stego Image</h4>
                {extractedImageUrl && (
                  <img src={extractedImageUrl} alt="Stego" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                )}
              </div>
              <div>
                <h4 style={{ color: purple }}>💬 Hidden Message</h4>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', maxHeight: '200px', overflow: 'auto' }}>
                  <pre style={{ color: '#4ade80', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>{extractedData}</pre>
                </div>
              </div>
            </div>

            {extractedHiddenFileUrl && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <h4 style={{ color: purple }}>📎 Hidden File: {extractedHiddenFileName}</h4>
                {isHiddenFileImage && <img src={extractedHiddenFileUrl} alt="Hidden" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />}
                {isHiddenFileAudio && <audio controls src={extractedHiddenFileUrl} style={{ width: '100%' }} />}
                {isHiddenFileVideo && <video controls src={extractedHiddenFileUrl} style={{ maxWidth: '100%' }} />}
                <button onClick={() => { const a = document.createElement('a'); a.href = extractedHiddenFileUrl; a.download = extractedHiddenFileName; a.click(); }} style={blackButton}>Download File</button>
              </div>
            )}
          </div>
        )}

        {/* Activity Log */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '15px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          marginTop: '20px'
        }}>
          <h3 style={{ color: purple, marginBottom: '15px', borderLeft: `3px solid ${purple}`, paddingLeft: '10px' }}>Activity Log</h3>
          <div style={{ maxHeight: '120px', overflow: 'auto' }}>
            {activityLog.map((log, i) => (
              <div key={i} style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#4ade80' : '#aaa', fontSize: '11px', padding: '4px 0' }}>
                [{log.timestamp}] {log.message}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
          <button style={blackButton} onClick={() => window.scrollTo(0, 0)}>Top</button>
          <button style={coloredButton} onClick={() => { if (window.confirm('Clear all data?')) { setCarrierImageUrl(''); setEditTextContent(''); setFileToHideContent(''); setStegoImageUrl(null); setExtractedData(''); setExtractedImageUrl(''); setExtractedHiddenFileUrl(''); setActivityLog([]); addLog('All data cleared', 'info'); } }}>Clear All</button>
          <button style={blackButton} onClick={openHelp}>Help</button>
        </div>
      </div>

      {/* Crypto Modal */}
      {showCryptoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '16px', padding: '30px', maxWidth: '420px', width: '90%', border: `2px solid ${purple}` }}>
            <h2 style={{ color: purple, textAlign: 'center', marginBottom: '20px' }}>{cryptoMode === 'encrypt' ? 'Encrypt Text' : 'Decrypt Text'}</h2>
            <input type={hidePassword ? 'password' : 'text'} value={passPhrase} onChange={(e) => setPassPhrase(e.target.value)} placeholder="Enter pass phrase (min 6 chars)" style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', background: '#0f0f1a', border: `1px solid ${purple}`, color: 'white' }} />
            {cryptoMode === 'encrypt' && (
              <input type={hidePassword ? 'password' : 'text'} value={confirmPassPhrase} onChange={(e) => setConfirmPassPhrase(e.target.value)} placeholder="Confirm pass phrase" style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', background: '#0f0f1a', border: `1px solid ${purple}`, color: 'white' }} />
            )}
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' }}>
              <label style={{ color: '#aaa', fontSize: '12px' }}><input type="checkbox" checked={hidePassword} onChange={(e) => setHidePassword(e.target.checked)} /> Hide Password</label>
              <label style={{ color: '#aaa', fontSize: '12px' }}><input type="checkbox" checked={showStrength} onChange={(e) => setShowStrength(e.target.checked)} /> Strength</label>
              <label style={{ color: '#aaa', fontSize: '12px' }}><input type="checkbox" onClick={openSafeModal} /> Open Safe</label>
            </div>
            {showStrength && passPhrase && (
              <div><p style={{ color: '#fbbf24', fontSize: '11px' }}>Strength: {getStrengthText()}/5</p></div>
            )}
            {errorMessage && <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '15px' }}>{errorMessage}</div>}
            <button onClick={useDefaultPassphrase} style={{ width: '100%', background: '#374151', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>Use Default</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCryptoModal(false)} style={blackButton}>Cancel</button>
              <button onClick={handleCryptoAction} style={coloredButton}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Safe Modal */}
      {showSafeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '16px', padding: '25px', maxWidth: '380px', width: '90%', border: `2px solid ${pink}` }}>
            <h2 style={{ color: pink, textAlign: 'center', marginBottom: '20px' }}>Password Safe</h2>
            <input type="password" value={safePassPhrase} onChange={(e) => setSafePassPhrase(e.target.value)} placeholder="Enter pass phrase" autoFocus style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', background: '#0f0f1a', border: `1px solid ${pink}`, color: 'white' }} />
            {safeErrorMessage && <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '15px' }}>{safeErrorMessage}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSafeModal(false)} style={blackButton}>Cancel</button>
              <button onClick={handleSafeOk} style={coloredButton}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Extract Password Modal */}
      {showExtractPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '16px', padding: '25px', maxWidth: '380px', width: '90%', border: `2px solid ${purple}` }}>
            <h2 style={{ color: purple, textAlign: 'center', marginBottom: '20px' }}>🔐 Decrypt Hidden Text</h2>
            <p style={{ color: '#aaa', textAlign: 'center', marginBottom: '20px' }}>Enter the password to decrypt:</p>
            <input type="password" value={extractPassword} onChange={(e) => setExtractPassword(e.target.value)} placeholder="Enter password" autoFocus style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', background: '#0f0f1a', border: `1px solid ${purple}`, color: 'white' }} />
            {extractErrorMessage && <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '15px' }}>{extractErrorMessage}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowExtractPasswordModal(false); setPendingPayload(null); setExtractPassword(''); setExtractErrorMessage(''); }} style={blackButton}>Cancel</button>
              <button onClick={handleExtractWithPassword} style={coloredButton}>Decrypt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;