import { useState, useEffect, useCallback } from 'react';
import { Order } from '../types/order';
import { storage } from '../lib/storage';

export function useOrdersHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = useCallback(() => {
    const list = storage.getOrders();
    setOrders(list);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const removeOrder = useCallback(
    (id: string) => {
      storage.deleteOrder(id);
      loadOrders();
    },
    [loadOrders]
  );

  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      (order.customer.name && order.customer.name.toLowerCase().includes(q)) ||
      (order.customer.phone && order.customer.phone.includes(q)) ||
      order.date.includes(q)
    );
  });

  return {
    orders: filteredOrders,
    totalCount: orders.length,
    searchQuery,
    setSearchQuery,
    reload: loadOrders,
    removeOrder,
  };
}
