import React, { createContext, useContext, useState } from 'react';

const BookingContext = createContext();

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

export const BookingProvider = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [preOrderedItems, setPreOrderedItems] = useState([]);
  const [specialRequests, setSpecialRequests] = useState('');

  const resetBooking = () => {
    setSelectedBranch(null);
    setSelectedTable(null);
    setSelectedDate('');
    setSelectedTime('');
    setPartySize(2);
    setPreOrderedItems([]);
    setSpecialRequests('');
  };

  const value = {
    selectedBranch,
    setSelectedBranch,
    selectedTable,
    setSelectedTable,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    partySize,
    setPartySize,
    preOrderedItems,
    setPreOrderedItems,
    specialRequests,
    setSpecialRequests,
    resetBooking
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};
