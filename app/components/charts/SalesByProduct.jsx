import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export default function SalesByProduct({ data }) {
  return (
    <div>
      <h2 className="font-semibold mb-2">
        Top 5 Produk dengan Penjualan Tertinggi
      </h2>

      <BarChart width={500} height={300} data={data}>
        <XAxis dataKey="produk" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="total" />
      </BarChart>
    </div>
  )
}
