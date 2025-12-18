export function topProducts(data) {
  const map = {}

  data.forEach(item => {
    const total = Number(item.total_penjualan)
    const produk = item.produk

    map[produk] = (map[produk] || 0) + total
  })

  return Object.entries(map)
    .map(([produk, total]) => ({ produk, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}
