import React, { useState } from 'react';
import type { DatabaseConfig, DatabaseType } from '../../shared/types';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [dbType, setDbType] = useState<DatabaseType>('sqlite');
  const [postgresConfig, setPostgresConfig] = useState({
    host: 'localhost',
    port: '5432',
    database: 'dawacare_pos',
    username: 'postgres',
    password: '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [initializing, setInitializing] = useState(false);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const config: DatabaseConfig = dbType === 'sqlite' 
      ? { type: 'sqlite' }
      : {
          type: 'postgresql',
          connectionString: `postgresql://${postgresConfig.username}:${postgresConfig.password}@${postgresConfig.host}:${postgresConfig.port}/${postgresConfig.database}`,
        };

    try {
      const result = await window.electronAPI.testDbConnection(config);
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = async () => {
    setInitializing(true);

    const config: DatabaseConfig = dbType === 'sqlite'
      ? { type: 'sqlite' }
      : {
          type: 'postgresql',
          connectionString: `postgresql://${postgresConfig.username}:${postgresConfig.password}@${postgresConfig.host}:${postgresConfig.port}/${postgresConfig.database}`,
        };

    try {
      const result = await window.electronAPI.initializeDb(config);
      if (result.success) {
        onComplete();
      } else {
        setTestResult({ success: false, message: result.error || 'Initialization failed' });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Initialization failed' });
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 animate-slide-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src={new URL('../assets/logo.png', import.meta.url).href} alt="DawaCare Logo" className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to DawaCare POS</h1>
          <p className="text-gray-600">Let's set up your database to get started</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s <= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-1 w-16 ${
                    s < step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Database</h2>
              
              <div className="space-y-4">
                {/* SQLite Option */}
                <label
                  className={`block p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    dbType === 'sqlite'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="dbType"
                    value="sqlite"
                    checked={dbType === 'sqlite'}
                    onChange={(e) => setDbType(e.target.value as DatabaseType)}
                    className="sr-only"
                  />
                  <div className="flex items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">SQLite (Recommended)</h3>
                      <p className="text-gray-600 mt-1">
                        Zero configuration required. Perfect for single-location pharmacies or getting started quickly.
                      </p>
                      <ul className="mt-2 text-sm text-gray-500 space-y-1">
                        <li>✓ No setup required</li>
                        <li>✓ File-based database</li>
                        <li>✓ Great for 1-3 users</li>
                      </ul>
                    </div>
                  </div>
                </label>

                {/* PostgreSQL Option */}
                <label
                  className={`block p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    dbType === 'postgresql'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="dbType"
                    value="postgresql"
                    checked={dbType === 'postgresql'}
                    onChange={(e) => setDbType(e.target.value as DatabaseType)}
                    className="sr-only"
                  />
                  <div className="flex items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">PostgreSQL (Advanced)</h3>
                      <p className="text-gray-600 mt-1">
                        Powerful database for high-volume operations and multiple concurrent users.
                      </p>
                      <ul className="mt-2 text-sm text-gray-500 space-y-1">
                        <li>✓ High performance</li>
                        <li>✓ Support for many concurrent users</li>
                        <li>✓ Advanced features</li>
                        <li>⚠ Requires PostgreSQL installation</li>
                      </ul>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 2 && dbType === 'postgresql' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">PostgreSQL Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                  <input
                    type="text"
                    className="input"
                    value={postgresConfig.host}
                    onChange={(e) => setPostgresConfig({ ...postgresConfig, host: e.target.value })}
                    placeholder="localhost"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input
                    type="text"
                    className="input"
                    value={postgresConfig.port}
                    onChange={(e) => setPostgresConfig({ ...postgresConfig, port: e.target.value })}
                    placeholder="5432"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
                  <input
                    type="text"
                    className="input"
                    value={postgresConfig.database}
                    onChange={(e) => setPostgresConfig({ ...postgresConfig, database: e.target.value })}
                    placeholder="dawacare_pos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    className="input"
                    value={postgresConfig.username}
                    onChange={(e) => setPostgresConfig({ ...postgresConfig, username: e.target.value })}
                    placeholder="postgres"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    className="input"
                    value={postgresConfig.password}
                    onChange={(e) => setPostgresConfig({ ...postgresConfig, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>

                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn btn-secondary w-full"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>

                {testResult && (
                  <div
                    className={`p-4 rounded-md ${
                      testResult.success
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {testResult.success ? '✓ Connection successful!' : `✗ ${testResult.message}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && dbType === 'sqlite' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">SQLite Configuration</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <p className="text-blue-800 mb-4">
                  SQLite is ready to go with zero configuration!
                </p>
                <p className="text-sm text-blue-600">
                  Your database will be stored in your application data folder.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Ready to Initialize</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-700 font-medium">Database Type:</span>
                  <span className="text-gray-900 font-semibold uppercase">{dbType}</span>
                </div>
                
                {dbType === 'postgresql' && (
                  <>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-700 font-medium">Host:</span>
                      <span className="text-gray-900">{postgresConfig.host}:{postgresConfig.port}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-700 font-medium">Database:</span>
                      <span className="text-gray-900">{postgresConfig.database}</span>
                    </div>
                  </>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> A default admin account will be created with:
                  </p>
                  <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                    <li>• Email: admin@dawacare.local</li>
                    <li>• Password: admin123</li>
                    <li className="text-red-600 font-medium">⚠ Please change this password after first login!</li>
                  </ul>
                </div>
              </div>

              {testResult && !testResult.success && (
                <div className="bg-red-50 text-red-800 border border-red-200 p-4 rounded-md">
                  ✗ {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1 || initializing}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (step === 2 && dbType === 'postgresql' && (!testResult || !testResult.success))
              }
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={initializing}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initializing ? 'Initializing...' : 'Finish Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
