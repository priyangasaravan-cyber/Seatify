import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { BookingProvider } from './contexts/BookingContext';

// Pages
import Home from './pages/Home';
import Branches from './pages/Branches';
import BranchDetail from './pages/BranchDetail';
import Menu from './pages/Menu';
import Booking from './pages/Booking';
import MyBookings from './pages/MyBookings';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BookingProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Navbar />
              <main>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/branches" element={<Branches />} />
                  <Route path="/branches/:id" element={<BranchDetail />} />
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/menu/:id" element={<Menu />} />
                  <Route path="/booking" element={<Booking />} />
                  <Route path="/my-bookings" element={
                    <ProtectedRoute>
                      <MyBookings />
                    </ProtectedRoute>
                  } />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <ProtectedRoute adminOnly>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                </Routes>
              </main>
              <Footer />
              <Toaster position="top-right" />
            </div>
          </Router>
        </BookingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
