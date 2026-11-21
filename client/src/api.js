import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getCategories = () => api.get('/categories')
export const createCategory = (data) => api.post('/categories', data)
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data)
export const deleteCategory = (id, force = false) => api.delete(`/categories/${id}?force=${force}`)

export const getProducts = (params) => api.get('/products', { params })
export const getProduct = (id) => api.get(`/products/${id}`)
export const createProduct = (data) => api.post('/products', data)
export const updateProduct = (id, data) => api.put(`/products/${id}`, data)
export const deleteProduct = (id) => api.delete(`/products/${id}`)

export const updateStock = (data) => api.post('/inventory/update', data)
export const getStockLogs = (productId) => api.get(`/inventory/logs/${productId}`)

export const getDashboard = () => api.get('/dashboard')
export const getReports = () => api.get('/reports')

export default api
