import React from 'react';
import { ResultsPage } from './ResultsPage';
import { StoreInfo } from '../types/order';

export interface ReviewPageProps {
  currentStore?: StoreInfo;
}

/**
 * ReviewPage (Unified into Results & Download)
 * Seamlessly renders the combined Results & Download page.
 */
export const ReviewPage: React.FC<ReviewPageProps> = (props) => {
  return <ResultsPage {...props} />;
};

export default ReviewPage;
