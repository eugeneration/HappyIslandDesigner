import React, { useState, useRef } from 'react';
import Modal from 'react-modal';
import { Box, Flex, Heading, Text } from '@theme-ui/components';
import i18next from 'i18next';
import { colors } from '../colors';
import { trackLanguageChange } from '../analytics';
import './modal.scss';

const customStyles: Modal.Styles = {
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'relative',
    inset: 'auto',
    border: 'none',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '400px',
    width: '90%',
    backgroundColor: colors.paper.cssColor,
    overflow: 'auto',
    maxHeight: '80vh',
  },
};

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
];

// Hardcoded restart messages so they display in the *selected* language,
// not the current UI language (which the user may not be able to read).
const RESTART_MESSAGES: Record<string, string> = {
  'en': 'Please reload the page for the language change to take effect.',
  'zh-CN': '请重新加载页面以使语言更改生效。',
  'zh-TW': '請重新載入頁面以使語言變更生效。',
  'es-ES': 'Por favor, recarga la página para que el cambio de idioma surta efecto.',
  'ja': '言語の変更を反映するにはページを再読み込みしてください。',
  'ko': '언어 변경을 적용하려면 페이지를 새로고침해 주세요.',
  'fr': 'Veuillez recharger la page pour appliquer le changement de langue.',
  'de': 'Bitte laden Sie die Seite neu, damit die Sprachänderung wirksam wird.',
};

function ModalSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentLang = localStorage.getItem('preferred_language') || i18next.language;

  const [restartMessage, setRestartMessage] = useState('');

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    trackLanguageChange(currentLang, lang);
    localStorage.setItem('preferred_language', lang);
    setRestartMessage(RESTART_MESSAGES[lang] || RESTART_MESSAGES['en']);
    setShowRestart(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        id="settings-modal-button"
        style={{ display: 'none' }}
        onClick={() => setIsOpen(true)}
      />
      {/* @ts-ignore - react-modal types incompatible with React 16 */}
      <Modal
        isOpen={isOpen}
        onRequestClose={() => { setIsOpen(false); setShowRestart(false); }}
        style={customStyles}
        closeTimeoutMS={200}
        ariaHideApp={false}
      >
        <Heading m={2} sx={{ textAlign: 'center' }}>
          {i18next.t('settings')}
        </Heading>

        <Box sx={{ mb: 3 }}>
          <Flex sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Flex sx={{ alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke={colors.text.cssColor} strokeWidth="2" />
                <ellipse cx="12" cy="12" rx="4" ry="10" stroke={colors.text.cssColor} strokeWidth="2" />
                <line x1="2" y1="12" x2="22" y2="12" stroke={colors.text.cssColor} strokeWidth="2" />
              </svg>
              <Text sx={{
                fontFamily: 'Quicksand, sans-serif',
                color: colors.text.cssColor,
                fontSize: '16px',
                fontWeight: 'bold',
              }}>
                {i18next.t('settings_language')}
              </Text>
            </Flex>
            <select
              defaultValue={currentLang}
              onChange={handleLanguageChange}
              style={{
                fontFamily: 'Quicksand, sans-serif',
                fontSize: '14px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: `2px solid ${colors.paperOverlay2.cssColor}`,
                backgroundColor: colors.white.cssColor,
                color: colors.text.cssColor,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Flex>

          {showRestart && (
            <Text sx={{
              fontFamily: 'Quicksand, sans-serif',
              color: '#1976D2',
              fontWeight: 'bold',
              fontSize: '13px',
              mt: 1,
            }}>
              {restartMessage}
            </Text>
          )}
        </Box>
      </Modal>
    </>
  );
}

export function OpenSettingsModal() {
  document.getElementById('settings-modal-button')?.click();
}

export default ModalSettings;
