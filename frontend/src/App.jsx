import React, { useState, useCallback, useEffect } from 'react';
import {
  MainMenu,
  CashierReportForm,
  InventoryForm,
  ReceivingForm,
  WriteOffForm
} from './components/forms';
import { NotificationScreen } from './components/common';
import { apiService } from './services/apiService';
import './App.css';

// Locations list
const LOCATIONS = [
  'ул. 8-я Нижняя Ак. №36',
  'ул. 12-я Верхняя Ак. №12',
  'ул. Ал. Матросова №139к3',
  'ул. Гагарина №35',
  'ул. Короленко №43',
  'ул. Советская №7',
  'ул. Октябрьская №10а',
  'ул. Терешковой №6а',
  'пр. Речицкий д.3а'
];

// Draft storage functions
const getDrafts = () => {
  try {
    const drafts = localStorage.getItem('report-drafts');
    return drafts ? JSON.parse(drafts) : [];
  } catch (error) {
    console.error('Error loading drafts:', error);
    return [];
  }
};

const saveDrafts = (drafts) => {
  try {
    localStorage.setItem('report-drafts', JSON.stringify(drafts));
  } catch (error) {
    console.error('Error saving drafts:', error);
  }
};

const generateDraftId = () => `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function App() {
  const [currentForm, setCurrentForm] = useState('menu');
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [notification, setNotification] = useState(null);
  const [drafts, setDrafts] = useState([]);

  // Load drafts on app start
  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  // Draft management functions
  const saveDraft = useCallback(async (type, data) => {
    if (!data || typeof data !== 'object') return;

    try {
      const drafts = getDrafts();
      const now = new Date().toISOString();

      let draftToUpdate = drafts.find(d => d.id === currentDraftId);

      if (draftToUpdate) {
        // Update existing draft
        draftToUpdate.data = data;
        draftToUpdate.updatedAt = now;
      } else {
        // Create new draft
        const newDraftId = generateDraftId();
        setCurrentDraftId(newDraftId);

        const newDraft = {
          id: newDraftId,
          type,
          data,
          createdAt: now,
          updatedAt: now
        };

        drafts.push(newDraft);
      }

      saveDrafts(drafts);
      setDrafts(drafts);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [currentDraftId]);

  const loadDraft = useCallback((draftId) => {
    try {
      const drafts = getDrafts();
      const draft = drafts.find(d => d.id === draftId);
      return draft ? draft.data : null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }, []);

  const deleteDraft = useCallback((draftId) => {
    try {
      const drafts = getDrafts();
      const updatedDrafts = drafts.filter(d => d.id !== draftId);
      saveDrafts(updatedDrafts);
      setDrafts(updatedDrafts);

      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
        setCurrentForm('menu');
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }, [currentDraftId]);

  const clearCurrentDraft = useCallback(() => {
    if (currentDraftId) {
      deleteDraft(currentDraftId);
    }
  }, [currentDraftId, deleteDraft]);

  // Navigation functions
  const goToMenu = useCallback(() => {
    setCurrentForm('menu');
    setCurrentDraftId(null);
    setValidationErrors({});
  }, []);

  // Notification functions
  const showNotification = useCallback((type, title, message) => {
    setNotification({ type, title, message });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
    goToMenu();
  }, [goToMenu]);

  const showValidationErrors = useCallback((errors) => {
    setValidationErrors(errors);

    // Scroll to first error field
    setTimeout(() => {
      const firstErrorField = Object.keys(errors)[0];
      const firstErrorElement = document.querySelector(`[name="${firstErrorField}"], [id="${firstErrorField}"]`);

      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        firstErrorElement.focus();
      } else {
        // Scroll to top if no specific field found
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Form props object
  const formProps = {
    isLoading,
    setIsLoading,
    validationErrors,
    setValidationErrors,
    showValidationErrors,
    showNotification,
    clearCurrentDraft,
    currentDraftId,
    loadDraft,
    saveDraft,
    goToMenu,
    locations: LOCATIONS,
    apiService
  };

  // Show notification screen if notification exists
  if (notification) {
    return (
      <NotificationScreen
        notification={notification}
        clearNotification={clearNotification}
      />
    );
  }

  // Render appropriate form
  switch (currentForm) {
    case 'cashier':
      return <CashierReportForm {...formProps} />;
    case 'inventory':
      return <InventoryForm {...formProps} />;
    case 'receiving':
      return <ReceivingForm {...formProps} />;
    case 'writeoff':
      return <WriteOffForm {...formProps} />;
    default:
      return (
        <MainMenu
          drafts={drafts}
          setCurrentForm={setCurrentForm}
          setCurrentDraftId={setCurrentDraftId}
          setValidationErrors={setValidationErrors}
          deleteDraft={deleteDraft}
        />
      );
  }
}

export default App;