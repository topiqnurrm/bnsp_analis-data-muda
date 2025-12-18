'use client'

import { useEffect, useState } from 'react'
import { readCSV } from './lib/readCSV'
import { topProducts } from './lib/analysis'

import SalesByProduct from './components/charts/SalesByProduct'
import Explanation from './components/Explanation'

export default function Dashboard() {
  const [data, setData] = useState([])

  useEffect(() => {
    readCSV().then(setData)
  }, [])

  const top5 = topProducts(data)

  return (
    <main className="p-6 space-y-10">
      <h1 className="text-2xl font-bold">
        Dashboard Analisis Penjualan
      </h1>

      <SalesByProduct data={top5} />

      <Explanation />
    </main>
  )
}
