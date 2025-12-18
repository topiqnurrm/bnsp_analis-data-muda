export async function readCSV() {
  const res = await fetch('/data/dataset_penjualan.csv')
  const text = await res.text()

  const lines = text.split('\n')
  const headers = lines[0].split(',')

  const data = lines.slice(1).map(line => {
    const values = line.split(',')
    const obj = {}

    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim()
    })

    return obj
  })

  return data
}
