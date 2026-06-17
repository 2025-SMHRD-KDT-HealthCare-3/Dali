import { api } from './client'

export const reportApi = {
  getDaily:   (date)  => api.get(`/reports/daily${date  ? `?date=${date}`   : ''}`),
  getMonthly: (month) => api.get(`/reports/monthly${month ? `?month=${month}` : ''}`),
}
