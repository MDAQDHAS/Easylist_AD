import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { OrderWorkflowProvider } from './context/OrderWorkflowContext';

export const App: React.FC = () => {
  return (
    <OrderWorkflowProvider>
      <RouterProvider router={router} />
    </OrderWorkflowProvider>
  );
};

export default App;
