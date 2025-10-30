# Seatify - Advanced Multi-Branch Restaurant Reservation System

A comprehensive restaurant reservation system with theme-based seating, menu management, payment integration, and admin dashboard.

## Features

### 🍽️ Core Features
- **Multi-Branch Support** - Manage multiple restaurant locations
- **Theme-Based Seating** - Premium, Gen Z, Royal, Family, Friends, Business, Romantic, Casual themes
- **Real-Time Booking** - Live table availability and instant confirmation
- **Menu Management** - Pre-ordering with dietary preferences and special offers
- **Payment Integration** - Razorpay integration with refund handling
- **Admin Dashboard** - Complete restaurant operations management
- **Loyalty Program** - Points system with membership tiers
- **Responsive Design** - Mobile and desktop optimized

### 🎨 Theme-Based Seating
- **Premium** - Elegant fine dining experience
- **Gen Z** - Vibrant and trendy space
- **Royal** - Luxurious royal dining
- **Family** - Perfect for family gatherings
- **Friends** - Casual hangout space
- **Business** - Professional meeting setting
- **Romantic** - Intimate couple dining
- **Casual** - Relaxed all-purpose seating

### 💳 Payment Features
- Razorpay integration
- Multiple payment methods
- Automatic refund processing
- Payment analytics and reporting

### 📊 Admin Features
- Branch and table management
- Menu and offers management
- Booking and payment analytics
- User management
- Real-time notifications

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **JWT** authentication
- **Razorpay** payment integration
- **Socket.io** for real-time updates
- **Nodemailer** for notifications

### Frontend
- **React 18** with Hooks
- **React Router** for navigation
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **Axios** for API calls
- **React Hook Form** for forms
- **Framer Motion** for animations

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- npm or yarn

### Backend Setup

1. Navigate to server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/seatify
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

4. Start the server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Quick Start

1. Install all dependencies:
```bash
npm run install-all
```

2. Start both frontend and backend:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Branches
- `GET /api/branches` - Get all branches
- `GET /api/branches/:id` - Get branch details
- `GET /api/branches/:id/availability` - Check availability

### Tables
- `GET /api/tables` - Get tables with filters
- `GET /api/tables/themes` - Get available themes
- `GET /api/tables/availability/check` - Check table availability

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get user bookings
- `PUT /api/bookings/:id/cancel` - Cancel booking
- `POST /api/bookings/:id/checkin` - Check in

### Payments
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/refund` - Process refund

### Menu
- `GET /api/menu` - Get menu items
- `GET /api/menu/branch/:id` - Get branch menu
- `POST /api/menu/:id/review` - Add review

## Database Schema

### User
- Profile information
- Loyalty points and membership tier
- Preferences and dietary restrictions

### Branch
- Location and contact information
- Operating hours
- Amenities and features
- Capacity and settings

### Table
- Theme type and seating capacity
- Location within branch
- Availability and pricing
- Special features

### Booking
- User, branch, and table references
- Date, time, and party size
- Payment and cancellation details
- Pre-ordered items

### Payment
- Razorpay integration
- Transaction details
- Refund processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Authors

- **Priyanga S** (RA2411026010797)
- **Alisha Athish Swain** (RA2411026010795)

B.Tech CSE AIML - AN1 Section

## License

This project is licensed under the MIT License.

## Future Enhancements

- Interactive seat map with drag-and-drop selection
- Waitlist and auto-assignment system
- Advanced loyalty program with referral system
- Multi-language support
- AI-powered recommendations
- Mobile app development
- Integration with POS systems
- Advanced analytics and reporting
