import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Star, Clock, Users, Phone, Mail, Wifi, Car, Music } from 'lucide-react';
import axios from 'axios';

const BranchDetail = () => {
  const { id } = useParams();
  const [branch, setBranch] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranchDetails();
    fetchTables();
  }, [id]);

  const fetchBranchDetails = async () => {
    try {
      const response = await axios.get(`/api/branches/${id}`);
      setBranch(response.data.data.branch);
    } catch (error) {
      console.error('Error fetching branch details:', error);
    }
  };

  const fetchTables = async () => {
    try {
      const response = await axios.get(`/api/branches/${id}/tables`);
      setTables(response.data.data.tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Branch not found</h2>
          <Link to="/branches" className="text-purple-600 hover:text-purple-800">
            ← Back to Branches
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">{branch.name}</h1>
          <div className="flex items-center text-lg">
            <MapPin className="w-5 h-5 mr-2" />
            <span>{branch.fullAddress}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Branch Info */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">About This Branch</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-purple-600" />
                      <span>{branch.contactInfo.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2 text-purple-600" />
                      <span>{branch.contactInfo.email}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Operating Hours</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Monday - Friday:</span>
                      <span>10:00 AM - 11:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday - Sunday:</span>
                      <span>9:00 AM - 12:00 AM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tables Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6">Available Tables</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {tables.map((table) => (
                  <div key={table._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
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
                    <div className="text-sm text-gray-600 mb-3">
                      {table.location.floor} Floor • {table.location.section}
                    </div>
                    <Link
                      to={`/booking?branch=${id}&table=${table._id}`}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-center block"
                    >
                      Book This Table
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rating */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold mb-4">Customer Rating</h3>
              <div className="flex items-center mb-2">
                <Star className="w-5 h-5 text-yellow-400 mr-1" />
                <span className="text-2xl font-bold">{branch.rating.average.toFixed(1)}</span>
                <span className="text-gray-600 ml-2">({branch.rating.count} reviews)</span>
              </div>
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold mb-4">Amenities</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Wifi className="w-4 h-4 mr-2 text-purple-600" />
                  <span>Free WiFi</span>
                </div>
                <div className="flex items-center">
                  <Car className="w-4 h-4 mr-2 text-purple-600" />
                  <span>Parking Available</span>
                </div>
                <div className="flex items-center">
                  <Music className="w-4 h-4 mr-2 text-purple-600" />
                  <span>Live Music</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to={`/booking?branch=${id}`}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-center block"
                >
                  Make a Reservation
                </Link>
                <Link
                  to={`/menu?branch=${id}`}
                  className="w-full border border-purple-600 text-purple-600 py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors text-center block"
                >
                  View Menu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchDetail;
