import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Clock, Users, Filter, Search } from 'lucide-react';
import axios from 'axios';

const Menu = () => {
  const [searchParams] = useSearchParams();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    dietary: [],
    search: ''
  });

  useEffect(() => {
    fetchMenuItems();
  }, [searchParams]);

  const fetchMenuItems = async () => {
    try {
      const branchId = searchParams.get('branch');
      const url = branchId ? `/api/menu/branch/${branchId}` : '/api/menu';
      const response = await axios.get(url);
      
      if (branchId) {
        setMenuItems(response.data.data.menuItems);
      } else {
        setMenuItems(response.data.data.menuItems);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'Appetizers', 'Main Course', 'Desserts', 'Beverages', 
    'Salads', 'Soups', 'Breads', 'Combo Meals', 'Specials', 'Kids Menu'
  ];

  const dietaryOptions = [
    { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
    { value: 'vegan', label: 'Vegan', icon: '🌱' },
    { value: 'glutenFree', label: 'Gluten Free', icon: '🌾' },
    { value: 'dairyFree', label: 'Dairy Free', icon: '🥛' },
    { value: 'spicy', label: 'Spicy', icon: '🌶️' }
  ];

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesSearch = !filters.search || 
      item.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      item.description.toLowerCase().includes(filters.search.toLowerCase());
    const matchesDietary = filters.dietary.length === 0 || 
      filters.dietary.some(diet => item.dietaryInfo[diet]);
    
    return matchesCategory && matchesSearch && matchesDietary;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Menu</h1>
          <p className="text-xl text-gray-600">Discover our delicious offerings</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          {/* Dietary Filters */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Dietary Preferences</h3>
            <div className="flex flex-wrap gap-2">
              {dietaryOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    const newDietary = filters.dietary.includes(option.value)
                      ? filters.dietary.filter(d => d !== option.value)
                      : [...filters.dietary, option.value];
                    setFilters({...filters, dietary: newDietary});
                  }}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    filters.dietary.includes(option.value)
                      ? 'bg-purple-100 border-purple-500 text-purple-700'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-8">
          {Object.keys(groupedItems).map(category => (
            <div key={category} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-purple-600 text-white p-4">
                <h2 className="text-2xl font-bold">{category}</h2>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedItems[category].map(item => (
                    <div key={item._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-white text-4xl font-bold">
                          {item.name.charAt(0)}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 mr-1" />
                          <span className="text-sm text-gray-600">
                            {item.rating.average.toFixed(1)} ({item.rating.count})
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="w-4 h-4 mr-1" />
                          <span>{item.preparationTime} min</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl font-bold text-purple-600">₹{item.price}</span>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-sm text-gray-500 line-through">₹{item.originalPrice}</span>
                          )}
                        </div>
                        <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm">
                          Add to Order
                        </button>
                      </div>

                      {/* Dietary Tags */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Object.entries(item.dietaryInfo).map(([key, value]) => 
                          value && (
                            <span key={key} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {Object.keys(groupedItems).length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🍽️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No menu items found</h3>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;
