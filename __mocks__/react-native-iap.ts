export const initConnection = jest.fn().mockResolvedValue(true);
export const endConnection = jest.fn().mockResolvedValue(undefined);
export const finishTransaction = jest.fn().mockResolvedValue(undefined);

export const fetchProducts = jest.fn().mockResolvedValue([
  {
    id: 'monthly_sub',
    productId: 'monthly_sub',
    displayPrice: '$9.99',
    price: 9.99,
    currency: 'USD',
    title: 'Monthly',
  },
  {
    id: 'yearly_sub',
    productId: 'yearly_sub',
    displayPrice: '$59.99',
    price: 59.99,
    currency: 'USD',
    title: 'Yearly',
  },
]);

export const requestPurchase = jest.fn().mockResolvedValue({ transactionId: 'mock-txn' });
export const getAvailablePurchases = jest.fn().mockResolvedValue([]);
export const getActiveSubscriptions = jest.fn().mockResolvedValue([]);
export const purchaseUpdatedListener = jest.fn(() => ({ remove: jest.fn() }));
export const purchaseErrorListener = jest.fn(() => ({ remove: jest.fn() }));
