// src/components/Fin.jsx
import React, { useState } from 'react';

export default function Fin() {
  const [status, setStatus] = useState('idle'); // idle | processing | done | error
  const [downloadUrl, setDownloadUrl] = useState(null);

  const start = async (ex) => {
    setStatus('processing');
    try {
      // Изменяем на GET запрос к существующему endpoint
      const response = await fetch(`/api/finviz?exchange=${ex}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Создаем blob для скачивания
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      setDownloadUrl(url);
      setStatus('done');
    } catch (error) {
      console.error('Ошибка при сборе данных:', error);
      setStatus('error');
    }
  };

  const download = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `tickers-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    }
  };

  const reset = () => {
    setStatus('idle');
    setDownloadUrl(null);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50 flex flex-col items-center">
      <h1 className="text-3xl font-semibold mb-8">finScrapperExel</h1>

      {status === 'idle' && (
        <div className="flex space-x-4">
          <button
            onClick={() => start('nyse')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Запустить сбор NYSE
          </button>
          <button
            onClick={() => start('nasdaq')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Запустить сбор NASDAQ
          </button>
        </div>
      )}

      {status === 'processing' && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700">Идёт сбор данных… Пожалуйста, подождите.</p>
        </div>
      )}

      {status === 'done' && (
        <div className="text-center">
          <p className="text-green-600 mb-4">✅ Сбор данных завершён!</p>
          <div className="space-x-4">
            <button
              onClick={download}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Скачать готовый файл
            </button>
            <button
              onClick={reset}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Новый сбор
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ Произошла ошибка при сборе.</p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
}