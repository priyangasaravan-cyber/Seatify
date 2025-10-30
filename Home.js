import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Star, Users, Utensils, Sparkles } from 'lucide-react';

const Home = () => {
  const features = [
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Multiple Branches",
      description: "Choose from our premium locations across the city"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Theme-Based Seating",
      description: "Premium, Gen Z, Royal, Family, Friends & more"
    },
    {
      icon: <Utensils className="w-8 h-8" />,
      title: "Pre-Order Menu",
      description: "Browse and pre-order from our extensive menu"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Real-Time Booking",
      description: "Instant table availability and confirmation"
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: "Loyalty Program",
      description: "Earn points and unlock exclusive benefits"
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Special Offers",
      description: "Enjoy amazing deals and seasonal promotions"
    }
  ];

  const themes = [
    { name: 'Premium', color: 'bg-amber-600', description: 'Elegant fine dining' },
    { name: 'Gen Z', color: 'bg-pink-500', description: 'Vibrant & trendy' },
    { name: 'Royal', color: 'bg-yellow-600', description: 'Luxurious experience' },
    { name: 'Family', color: 'bg-teal-500', description: 'Perfect for families' },
    { name: 'Friends', color: 'bg-blue-500', description: 'Casual hangout' },
    { name: 'Business', color: 'bg-green-500', description: 'Professional setting' }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Welcome to <span className="text-yellow-300">Seatify</span>
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Experience the future of restaurant reservations with theme-based seating, 
            pre-ordering, and seamless payments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/branches" 
              className="bg-yellow-400 text-purple-800 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors"
            >
              Find Tables
            </Link>
            <Link 
              to="/menu" 
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors"
            >
              Browse Menu
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">
            Why Choose Seatify?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow">
                <div className="text-purple-600 mb-4 flex justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-800">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Theme Seating Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">
            Choose Your Perfect Ambiance
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {themes.map((theme, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                <div className={`w-16 h-16 ${theme.color} rounded-lg mb-4 flex items-center justify-center text-white font-bold text-xl`}>
                  {theme.name.charAt(0)}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-800">
                  {theme.name}
                </h3>
                <p className="text-gray-600 mb-4">
                  {theme.description}
                </p>
                <Link 
                  to="/branches" 
                  className="text-purple-600 font-semibold hover:text-purple-800 transition-colors"
                >
                  Book Now →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Experience Seatify?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have discovered the perfect dining experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/register" 
              className="bg-yellow-400 text-purple-800 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors"
            >
              Get Started
            </Link>
            <Link 
              to="/branches" 
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors"
            >
              Explore Branches
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
