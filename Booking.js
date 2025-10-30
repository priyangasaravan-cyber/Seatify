import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, MapPin, Star, CreditCard } from 'lucide-react';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const Booking = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
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
    specialRequests,
    setSpecialRequests
  } = useBooking();

  const [branches, setBranches] = useState([]);
  const [tables, setTables] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchTables();
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedBranch && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedBranch, selectedDate]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get('/api/branches');
      setBranches(response.data.data.branches);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchTables = async () => {
    try {
      const response = await axios.get(`/api/branches/${selectedBranch}/tables`);
      setTables(response.data.data.tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      const response = await axios.get(`/api/branches/${selectedBranch}/availability`, {
        params: {
          date: selectedDate,
          partySize: partySize
        }
      });
      setAvailableSlots(response.data.data.availableTables || []);
    } catch (error) {
      console.error('Error fetching available slots:', error);
    }
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch._id);
    setSelectedTable(null);
    setStep(2);
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table._id);
    setStep(3);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setStep(4);
  };

  const handleBookingSubmit = async () => {
    if (!selectedBranch || !selectedTable || !selectedDate || !selectedTime) {
      toast.error('Please complete all booking details');
      return;
    }

    setLoading(true);
    try {
      const bookingData = {
        branch: selectedBranch,
        table: selectedTable,
        date: selectedDate,
        startTime: selectedTime,
        endTime: calculateEndTime(selectedTime),
        partySize: partySize,
        specialRequests: specialRequests
      };

      const response = await axios.post('/api/bookings', bookingData);
      toast.success('Booking created successfully!');
      navigate('/my-bookings');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const calculateEndTime = (startTime) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + 2; // 2-hour booking duration
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const themeColors = {
    Premium: 'bg-amber-600',
    'Gen Z': 'bg-pink-500',
    Royal: 'bg-yellow-600',
    Family: 'bg-teal-500',
    Friends: 'bg-blue-500',
    Business: 'bg-green-500',
    Romantic: 'bg-pink-300',
    Casual: 'bg-green-300'
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Make a Reservation</h1>
          <p className="text-xl text-gray-600">Book your perfect table experience</p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= stepNumber ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {stepNumber}
                </div>
                {stepNumber < 4 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step > stepNumber ? 'bg-purple-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Branch</span>
            <span>Table</span>
            <span>Time</span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Step 1: Branch Selection */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Select a Branch</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {branches.map((branch) => (
                <div
                  key={branch._id}
                  onClick={() => handleBranchSelect(branch)}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <h3 className="text-lg font-semibold mb-2">{branch.name}</h3>
                  <div className="flex items-center text-gray-600 mb-2">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{branch.location.city}, {branch.location.state}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Star className="w-4 h-4 mr-2 text-yellow-400" />
                    <span>{branch.rating.average.toFixed(1)} ({branch.rating.count} reviews)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Table Selection */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Choose Your Table Theme</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => (
                <div
                  key={table._id}
                  onClick={() => handleTableSelect(table)}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    selectedTable === table._id ? 'ring-2 ring-purple-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Table {table.tableNumber}</h3>
                    <span className={`px-2 py-1 rounded text-white text-sm ${themeColors[table.themeType] || 'bg-gray-500'}`}>
                      {table.themeType}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600 mb-2">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{table.seats} seats</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {table.location.floor} Floor • {table.location.section}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Date & Time Selection */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Select Date & Time</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Party Size</label>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(size => (
                    <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {selectedDate && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Available Time Slots</h3>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'].map(time => (
                    <button
                      key={time}
                      onClick={() => handleTimeSelect(time)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium ${
                        selectedTime === time
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Confirm Your Booking</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Branch:</span>
                <span>{branches.find(b => b._id === selectedBranch)?.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Table:</span>
                <span>Table {tables.find(t => t._id === selectedTable)?.tableNumber} ({tables.find(t => t._id === selectedTable)?.themeType})</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Date & Time:</span>
                <span>{selectedDate} at {selectedTime}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Party Size:</span>
                <span>{partySize} {partySize === 1 ? 'person' : 'people'}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Special Requests (Optional)</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Any special requests or dietary requirements..."
                />
              </div>
            </div>
            
            <div className="mt-6 flex space-x-4">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleBookingSubmit}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;
