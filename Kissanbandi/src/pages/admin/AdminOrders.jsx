import React, { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../../services/api';
import { toast } from 'react-hot-toast';
import {
  Calendar, Download, Filter, RefreshCcw, Loader, AlertCircle, Search,
  Eye, Package, TrendingUp, Users, DollarSign, Clock,
  ChevronDown, ChevronUp, X, SortAsc, SortDesc, Grid, List,
  Phone
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import OrderDetailsModal from '../../components/modals/OrderDetailsModal';

// Framer Motion imports
import { AnimatePresence, motion } from 'framer-motion';

const ITEMS_PER_PAGE = 10;
const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const filterPanelVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1 }
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [orderStats, setOrderStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // --- API LOADERS ---
  const loadOrders = useCallback(async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit: ITEMS_PER_PAGE,
        status: filterStatus,
        search: searchTerm,
        sortField,
        sortOrder,
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() })
      };
      const response = await ordersApi.getAllOrders(params);
      if (!response || !response.orders)
        throw new Error('Invalid response format');
      setOrders(response.orders);
      setTotalPages(Math.ceil(response.total / ITEMS_PER_PAGE));
      setCurrentPage(page);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
      toast.error('Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterStatus, searchTerm, sortField, sortOrder]);

  const loadOrderStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      setError(null);
      const params = {
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() })
      };
      const response = await ordersApi.getOrderStats(params);
      if (!response || typeof response !== 'object')
        throw new Error('Invalid response format from stats API');
      setOrderStats({
        totalOrders: response.totalOrders || 0,
        totalRevenue: response.totalRevenue || 0,
        averageOrderValue: response.averageOrderValue || 0,
        statusBreakdown: response.statusBreakdown || {},
        dailyStats: Array.isArray(response.dailyStats) ? response.dailyStats : []
      });
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load order statistics';
      setError(errorMessage);
      toast.error(errorMessage);
      setOrderStats({
        totalOrders: orders.length,
        totalRevenue: 0,
        averageOrderValue: 0,
        statusBreakdown: {},
        dailyStats: []
      });
    } finally {
      setStatsLoading(false);
    }
  }, [startDate, endDate, orders.length]);

  useEffect(() => {
    loadOrders(1);
    loadOrderStats();
  }, [startDate, endDate, filterStatus, searchTerm, sortField, sortOrder]);

  // --- STATUS, BULK, EXPORT HANDLERS ---
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingStatus(orderId);
      await ordersApi.updateOrderStatus(orderId, newStatus);
      toast.success('Order status updated');
      await loadOrders(currentPage);
      await loadOrderStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedOrders.size === 0) {
      toast.error('No orders selected');
      return;
    }
    try {
      setBulkActionLoading(true);
      const orderIds = Array.from(selectedOrders);
      for (const orderId of orderIds) {
        await ordersApi.updateOrderStatus(orderId, newStatus);
      }
      toast.success(`${orderIds.length} orders updated to ${newStatus}`);
      setSelectedOrders(new Set());
      await loadOrders(currentPage);
      await loadOrderStats();
    } catch {
      toast.error('Failed to update selected orders');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportOrders = async () => {
    try {
      setExportLoading(true);
      setError(null);
      const params = {
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() }),
        ...(filterStatus && { status: filterStatus }),
        ...(searchTerm && { search: searchTerm })
      };
      const response = await ordersApi.exportOrders(params);
      if (!response) throw new Error('No response received from export API');
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Orders exported');
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to export orders';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setExportLoading(false);
    }
  };

  const resetFilters = () => {
    setDateRange([null, null]);
    setFilterStatus('');
    setSearchTerm('');
    setSortField('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
    setSelectedOrders(new Set());
    loadOrders(1);
    loadOrderStats();
  };

  // --- TABLE/CARD/HELPER UTILITIES ---
  const toggleOrderSelection = (orderId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) newSelected.delete(orderId);
    else newSelected.add(orderId);
    setSelectedOrders(newSelected);
  };
  const toggleAllOrders = () => {
    if (selectedOrders.size === orders.length) setSelectedOrders(new Set());
    else setSelectedOrders(new Set(orders.map(order => order._id)));
  };
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'shipped': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return <Package className="w-4 h-4" />;
      case 'shipped': return <TrendingUp className="w-4 h-4" />;
      case 'processing': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <SortAsc className="w-4 h-4 opacity-30" />;
    return sortOrder === 'asc'
      ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  // --- --- ANIMATED COMPONENTS --- ---

  // PAGINATION
  const renderPagination = () => {
    if (orders.length === 0) return null;
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
    return (
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-4 sm:px-6 py-3 bg-green-50 border-t border-green-100">
        <div className="text-sm text-gray-700 mb-2 sm:mb-0">
          Showing page {currentPage} of {totalPages} ({orders.length} orders)
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => loadOrders(1)}
            disabled={currentPage === 1 || loading}
            className="px-2 py-1 text-sm rounded bg-white text-gray-700 hover:bg-green-50 disabled:bg-gray-100 disabled:text-gray-400 border border-green-200 transition"
          >First</button>
          <button
            onClick={() => loadOrders(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1 text-sm rounded bg-white text-gray-700 hover:bg-green-50 disabled:bg-gray-100 disabled:text-gray-400 border border-green-200 transition"
          >Previous</button>
          {pages.map(page => (
            <button
              key={page}
              onClick={() => loadOrders(page)}
              className={`px-3 py-1 text-sm rounded border transition
                ${currentPage === page
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 hover:bg-green-50 border-green-200'
                }`}
            >{page}</button>
          ))}
          <button
            onClick={() => loadOrders(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="px-3 py-1 text-sm rounded bg-white text-gray-700 hover:bg-green-50 disabled:bg-gray-100 disabled:text-gray-400 border border-green-200 transition"
          >Next</button>
          <button
            onClick={() => loadOrders(totalPages)}
            disabled={currentPage === totalPages || loading}
            className="px-2 py-1 text-sm rounded bg-white text-gray-700 hover:bg-green-50 disabled:bg-gray-100 disabled:text-gray-400 border border-green-200 transition"
          >Last</button>
        </div>
      </div>
    );
  };

  // CARDS
  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {orders.map((order) => (
          <motion.div
            key={order._id}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 30 }}
            transition={{ type: "spring", stiffness: 190, damping: 19, duration: 0.17 }}
            className="bg-white rounded-lg shadow-md border border-green-100 hover:shadow-lg transition-shadow"
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order._id)}
                    onChange={() => toggleOrderSelection(order._id)}
                    className="rounded border-green-300 text-green-600 focus:ring-green-500"
                  />
                  <h3 className="font-medium text-gray-900 text-sm">#{order._id.slice(-8)}</h3>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusBadgeClass(order.status)}`}>
                  {getStatusIcon(order.status)}
                  <span className="capitalize">{order.status || 'pending'}</span>
                </span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{order.user?.name || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium">₹{(order.totalAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                {order.user?.phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{order.user.phone}</span>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-1">Items ({order.items?.length || 0})</div>
                <div className="text-sm text-gray-700 max-h-16 overflow-y-auto">
                  {order.items?.slice(0, 2).map((item, index) => (
                    <div key={index} className="truncate">
                      {item.product?.name || 'Unknown Product'} × {item.quantity}
                    </div>
                  ))}
                  {order.items?.length > 2 && (
                    <div className="text-xs text-gray-500">+{order.items.length - 2} more items</div>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <motion.button
                  onClick={() => setSelectedOrder(order)}
                  className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.04 }}
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </motion.button>
                <select
                  value={order.status || 'pending'}
                  onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                  disabled={updatingStatus === order._id}
                  className="px-2 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  // TABLE
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-green-200">
        <thead className="bg-green-50">
          <tr>
            <th className="px-3 sm:px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedOrders.size === orders.length && orders.length > 0}
                onChange={toggleAllOrders}
                className="rounded border-green-300 text-green-600 focus:ring-green-500"
              />
            </th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer hover:bg-green-100" onClick={() => {
              setSortField('_id'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }}>
              <div className="flex items-center space-x-1"><span>Order ID</span><SortIcon field="_id" /></div>
            </th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer hover:bg-green-100 hidden sm:table-cell" onClick={() => {
              setSortField('user.name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }}>
              <div className="flex items-center space-x-1"><span>Customer</span><SortIcon field="user.name" /></div>
            </th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider hidden md:table-cell">Items</th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer hover:bg-green-100" onClick={() => {
              setSortField('totalAmount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }}>
              <div className="flex items-center space-x-1"><span>Total</span><SortIcon field="totalAmount" /></div>
            </th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Status</th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider hidden lg:table-cell">Contact</th>
            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-green-100">
          <AnimatePresence>
            {orders.map((order) => (
              <motion.tr
                key={order._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.20 }}
                className="hover:bg-green-50 transition-colors"
              >
                <td className="px-3 sm:px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order._id)}
                    onChange={() => toggleOrderSelection(order._id)}
                    className="rounded border-green-300 text-green-600 focus:ring-green-500"
                  />
                </td>
                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-medium">#{order._id.slice(-8)}</div>
                  <div className="text-xs text-gray-500 sm:hidden">
                    {order.user?.name || 'N/A'}
                  </div>
                </td>
                <td className="px-3 sm:px-6 py-4 hidden sm:table-cell">
                  <div className="text-sm font-medium text-gray-900">{order.user?.name || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</div>
                </td>
                <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                  <div className="text-sm text-gray-900 max-w-xs">
                    {order.items?.slice(0, 2).map((item, index) => (
                      <div key={index} className="truncate">
                        {item.product?.name || 'Unknown Product'} × {item.quantity}
                      </div>
                    ))}
                    {order.items?.length > 2 && (
                      <div className="text-xs text-gray-500">+{order.items.length - 2} more</div>
                    )}
                  </div>
                </td>
                <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                  ₹{(order.totalAmount || 0).toLocaleString()}
                </td>
                <td className="px-3 sm:px-6 py-4">
                  {updatingStatus === order._id ? (
                    <motion.div
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.0, repeat: Infinity }}
                      className="inline-flex items-center"
                    >
                      <Loader className="w-4 h-4 animate-spin mr-2 text-green-600" />
                      <span className="text-sm text-gray-500">Updating...</span>
                    </motion.div>
                  ) : (
                    <select
                      value={order.status || 'pending'}
                      onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(order.status)} focus:ring-2 focus:ring-green-500`}
                      disabled={updatingStatus === order._id}
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 sm:px-6 py-4 hidden lg:table-cell">
                  <div className="text-sm text-gray-900">{order.user?.phone || 'N/A'}</div>
                  <div className="text-sm text-gray-500">
                    {order.shippingAddress ? (
                      `${order.shippingAddress.city || 'N/A'}, ${order.shippingAddress.state || 'N/A'}`
                    ) : (
                      'Address not available'
                    )}
                  </div>
                </td>
                <td className="px-3 sm:px-6 py-4">
                  <motion.button
                    onClick={() => setSelectedOrder(order)}
                    className="text-green-600 hover:text-green-900 text-sm font-medium flex items-center space-x-1"
                    whileTap={{ scale: 0.95 }}
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">View</span>
                  </motion.button>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );

  // --- LOADING & ERROR STATES ---
  if (loading && !orders.length)
    return (
      <div className="flex justify-center items-center min-h-screen bg-green-50">
        <motion.div
          className="flex flex-col items-center bg-white p-8 rounded-lg shadow-lg"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.7, ease: 'linear' }}
          >
            <Loader className="w-8 h-8 text-green-600 mb-4" />
          </motion.div>
          <p className="text-gray-600">Loading orders...</p>
        </motion.div>
      </div>
    );

  if (error && !orders.length)
    return (
      <div className="p-4 sm:p-6 bg-green-50 min-h-screen">
        <motion.div
          className="max-w-2xl mx-auto bg-white rounded-xl p-6 shadow-lg border border-red-200"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-lg font-medium text-red-800">Error Loading Orders</h2>
          </div>
          <p className="mt-2 text-red-600">{error}</p>
          <motion.button
            onClick={() => loadOrders(1)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            whileTap={{ scale: 0.96 }}
          >Try Again</motion.button>
        </motion.div>
      </div>
    );

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-green-50">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-green-900 mb-2 sm:mb-0">
              Orders Management
            </h1>
            <div className="flex items-center space-x-2">
              <motion.button
                onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.06 }}
              >
                {viewMode === 'table' ? <Grid className="w-5 h-5" /> : <List className="w-5 h-5" />}
              </motion.button>
              <motion.button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors sm:hidden"
                whileTap={{ scale: 0.94 }}
              >
                <Filter className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Animated Filters/Search Panel */}
          <AnimatePresence initial={false}>
            {showFilters || window.innerWidth >= 640 ? (
              <motion.div
                className="space-y-4"
                key="filters"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={filterPanelVariants}
                transition={{ duration: 0.20 }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search orders by ID, customer name, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <DatePicker
                    selectsRange={true}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(update) => {
                      setDateRange(update);
                      setCurrentPage(1);
                    }}
                    isClearable={true}
                    placeholderText="Select date range"
                    className="w-full sm:w-auto px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-auto px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      onClick={resetFilters}
                      className="px-4 py-2 text-sm text-green-600 hover:text-green-800 hover:bg-green-100 flex items-center space-x-2 rounded-lg transition-colors border border-green-300"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <RefreshCcw className="w-4 h-4" /> <span>Reset</span>
                    </motion.button>
                    <motion.button
                      onClick={handleExportOrders}
                      disabled={exportLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      whileTap={{ scale: 0.97 }}
                    >
                      {exportLoading
                        ? <Loader className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                      <span>Export</span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden mt-4 w-full py-2 text-center text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-300"
          >
            {showFilters ? (
              <div className="flex items-center justify-center space-x-2">
                <ChevronUp className="w-4 h-4" /><span>Hide Filters</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <ChevronDown className="w-4 h-4" /><span>Show Filters</span>
              </div>
            )}
          </button>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedOrders.size > 0 && (
            <motion.div
              className="mb-6 p-4 bg-green-100 rounded-lg border border-green-200"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-green-800">
                  {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(status => (
                    <motion.button
                      key={status}
                      onClick={() => handleBulkStatusUpdate(status)}
                      disabled={bulkActionLoading}
                      className="px-3 py-1 text-xs bg-white text-green-700 rounded-lg hover:bg-green-50 border border-green-300 disabled:opacity-50 transition-colors"
                      whileTap={{ scale: 0.97 }}
                    >
                      {bulkActionLoading ? (
                        <Loader className="w-3 h-3 animate-spin" />
                      ) : (
                        `Mark as ${status.charAt(0).toUpperCase() + status.slice(1)}`
                      )}
                    </motion.button>
                  ))}
                  <motion.button
                    onClick={() => setSelectedOrders(new Set())}
                    className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-300 transition-colors"
                    whileTap={{ scale: 0.97 }}
                  >
                    Clear Selection
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order Statistics */}
        <div className="mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div className="bg-white p-4 rounded-lg shadow-md border border-green-100 relative"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              {statsLoading && (
                <motion.div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg"
                  animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.4 }}>
                  <Loader className="w-4 h-4 animate-spin text-green-600" />
                </motion.div>
              )}
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm text-gray-500">Total Orders</h3>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{orderStats?.totalOrders}</p>
                </div>
              </div>
            </motion.div>
            <motion.div className="bg-white p-4 rounded-lg shadow-md border border-green-100 relative"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.20, delay: 0.05 }}>
              {statsLoading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
                  <Loader className="w-4 h-4 animate-spin text-green-600" />
                </div>
              )}
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm text-gray-500">Total Revenue</h3>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    ₹{(orderStats?.totalRevenue || 0).toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
            <motion.div className="bg-white p-4 rounded-lg shadow-md border border-green-100 relative"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.09 }}>
              {statsLoading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
                  <Loader className="w-4 h-4 animate-spin text-green-600" />
                </div>
              )}
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm text-gray-500">Avg. Order Value</h3>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    ₹{orderStats?.averageOrderValue?.toFixed(0) || 0}</p>
                </div>
              </div>
            </motion.div>
            <motion.div className="bg-white p-4 rounded-lg shadow-md border border-green-100 relative col-span-2 lg:col-span-1"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.13 }}>
              {statsLoading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
                  <Loader className="w-4 h-4 animate-spin text-green-600" />
                </div>
              )}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm text-gray-500 mb-2">Status Breakdown</h3>
                  <div className="space-y-1">
                    {orderStats && Object.entries(orderStats.statusBreakdown || {}).slice(0, 3).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center text-xs">
                        <span className="capitalize text-gray-600">{status}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Orders Display */}
        <div className="bg-white rounded-lg shadow-md border border-green-100 overflow-hidden">
          <div className="p-4 bg-green-50 border-b border-green-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-green-900">
                Orders ({orders.length})
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={`${sortField}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortField(field); setSortOrder(order);
                  }}
                  className="px-3 py-1 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="totalAmount-desc">Highest Amount</option>
                  <option value="totalAmount-asc">Lowest Amount</option>
                  <option value="user.name-asc">Customer A-Z</option>
                  <option value="user.name-desc">Customer Z-A</option>
                </select>
              </div>
            </div>
          </div>

          <div className="relative">
            {loading && orders.length > 0 && (
              <motion.div
                className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.7, repeat: Infinity }}
              >
                <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
                  <Loader className="w-6 h-6 animate-spin text-green-600" />
                  <span className="text-gray-600">Updating orders...</span>
                </div>
              </motion.div>
            )}

            {orders.length === 0 ? (
              <motion.div
                className="p-8 text-center"
                initial={{ opacity: 0, scale: 0.93, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
              >
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
                <motion.button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  whileTap={{ scale: 0.96 }}
                >Clear All Filters</motion.button>
              </motion.div>
            ) : (
              <div className="p-0">
                {viewMode === 'table'
                  ? <div className="overflow-hidden">{renderTableView()}</div>
                  : <div className="p-4">{renderCardView()}</div>
                }
              </div>
            )}
          </div>
          {orders.length > 0 && renderPagination()}
        </div>

        {/* MODAL: Order Details */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              key="modal-bg"
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
            >
              <motion.div
                key="modal-content"
                initial={{ opacity: 0, y: 60, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.97 }}
                transition={{ duration: 0.23 }}
                style={{ zIndex: 40 }}
              >
                <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminOrders;
