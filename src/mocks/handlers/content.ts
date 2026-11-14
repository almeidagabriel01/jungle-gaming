import { http, HttpResponse } from 'msw'
import { ARTICLES } from '../seed'
import { API, route } from './http'

export const contentHandlers = [http.get(`${API}/journal`, route(() => HttpResponse.json({ items: ARTICLES })))]
