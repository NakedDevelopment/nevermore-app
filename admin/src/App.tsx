import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { useStore } from './store';
import { NotificationContainer } from './components/Notification';

function App() {
  const { checkAuth } = useStore();

  // Check for existing session on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <>
      <RouterProvider router={router} />
      <NotificationContainer />
    </>
  );
}

export default App;
