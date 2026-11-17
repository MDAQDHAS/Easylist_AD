import React from 'react';
import { ResultsPage } from './ResultsPage';
import { StoreInfo } from '../types/order';

export interface ExportPageProps {
  currentStore?: StoreInfo;
}

/**
 * ExportPage (Unified into Results & Download)
 * Seamlessly renders the combined Results & Download page.
 */
export const ExportPage: React.FC<ExportPageProps> = (props) => {
  return <ResultsPage {...props} />;
};

export default ExportPage;
