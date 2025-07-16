import React, { useState } from 'react';

export default function Fin() {
  const [status, setStatus] = useState('idle'); // idle | processing | done | error
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [currentExchange, setCurrentExchange] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Таймер для отображения времени выполнения
  React.useEffect(() => {
    let interval;
    if (status === 'processing' && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  const start = async (ex) => {
    setStatus('processing');
    setCurrentExchange(ex.toUpperCase());
    setStartTime(Date.now());
    setElapsedTime(0);
    setErrorMessage('');
    
    try {
      const response = await fetch(`/api/finviz?exchange=${ex}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
      }
      
      // Создаем blob для скачивания
      const blob = await response.blob();
      
      // Проверяем, что получили данные
      if (blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus('done');
      
    } catch (error) {
      console.error('Ошибка при сборе данных:', error);
      setErrorMessage(error.message || 'Неизвестная ошибка');
      setStatus('error');
    }
  };

  const download = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${currentExchange.toLowerCase()}-tickers-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    }
  };

  const reset = () => {
    setStatus('idle');
    setDownloadUrl(null);
    setCurrentExchange('');
    setErrorMessage('');
    setStartTime(null);
    setElapsedTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-xl">📊</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-800">finScrapperExel</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Сбор тикеров акций с Finviz для NYSE и NASDAQ
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {status === 'idle' && (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">
                Выберите биржу для сбора данных
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => start('nyse')}
                  className="group relative px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-md"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-2xl mr-2">▶️</span>
                    <span className="text-lg font-medium">NYSE</span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    New York Stock Exchange
                  </div>
                </button>
                
                <button
                  onClick={() => start('nasdaq')}
                  className="group relative px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 transform hover:scale-105 shadow-md"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-2xl mr-2">▶️</span>
                    <span className="text-lg font-medium">NASDAQ</span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    National Association of Securities Dealers
                  </div>
                </button>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-800">
                Собираем данные с {currentExchange}
              </h2>
              <p className="text-gray-600 mb-4">
                Пожалуйста, подождите. Это может занять несколько минут...
              </p>
              <div className="bg-gray-100 rounded-lg p-4 inline-block">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  Время выполнения: {formatTime(elapsedTime)}
                </div>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-4xl">✅</span>
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-800">
                Сбор данных завершён!
              </h2>
              <p className="text-gray-600 mb-6">
                Данные с биржи {currentExchange} успешно собраны за {formatTime(elapsedTime)}
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={download}
                  className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-xl mr-2">📥</span>
                    Скачать CSV файл
                  </div>
                </button>
                
                <div className="pt-4">
                  <button
                    onClick={reset}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    <span className="mr-2">🔄</span>
                    Новый сбор
                  </button>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-4xl">❌</span>
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-800">
                Произошла ошибка
              </h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-sm">
                  {errorMessage || 'Неизвестная ошибка при сборе данных'}
                </p>
              </div>
              
              <button
                onClick={reset}
                className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                <span className="mr-2">🔄</span>
                Попробовать снова
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>
            Сервис для автоматического сбора тикеров акций с сайта Finviz
          </p>
        </div>
      </div>
    </div>
  );
}