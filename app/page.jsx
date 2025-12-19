"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

// Fungsi untuk membaca dan parse CSV
function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  const data = lines.slice(1).map((line, index) => {
    const values = line.split(',');
    const obj = { _rawLineNumber: index + 2 };
    
    headers.forEach((header, idx) => {
      obj[header] = values[idx]?.trim() || '';
    });
    
    return obj;
  });
  
  return data;
}

// Fungsi untuk mengidentifikasi masalah data
function identifyDataIssues(rawData) {
  const issues = [];
  
  rawData.forEach((row, index) => {
    const lineNum = row._rawLineNumber;
    const problems = [];
    
    if (!row.quantity || row.quantity === '') {
      problems.push('quantity kosong');
    }
    
    if (!row.total_price || row.total_price === '') {
      problems.push('total_price kosong');
    }
    
    if (row.date.includes('-') && row.date.split('-')[0].length <= 2) {
      problems.push(`format tanggal DD-MM-YYYY: "${row.date}"`);
    }
    
    const qty = parseFloat(row.quantity) || 0;
    const price = parseFloat(row.price_per_unit) || 0;
    const total = parseFloat(row.total_price) || 0;
    
    if (qty > 0 && price > 0 && total > 0) {
      const expectedTotal = qty * price;
      const diff = Math.abs(expectedTotal - total);
      if (diff > 1) {
        problems.push(`kemungkinan kesalahan perhitungan (${qty} × ${price} ≠ ${total})`);
      }
    }
    
    if (problems.length > 0) {
      issues.push({
        lineNumber: lineNum,
        transactionId: row.transaction_id,
        product: row.product_name,
        region: row.region_name,
        problems: problems
      });
    }
  });
  
  return issues;
}

// Fungsi untuk membersihkan dan memproses data
function cleanData(rawData) {
  const cleaned = [];
  const skipped = [];
  
  rawData.forEach(row => {
    let date = row.date;
    if (date.includes('-') && date.split('-')[0].length <= 2) {
      const parts = date.split('-');
      date = `2024-${parts[1]}-${parts[0]}`;
    }
    
    const quantity = parseFloat(row.quantity) || 0;
    const price = parseFloat(row.price_per_unit) || 0;
    const total = parseFloat(row.total_price) || 0;
    
    if (total === 0 || quantity === 0) {
      skipped.push({
        transactionId: row.transaction_id,
        reason: 'Data tidak lengkap (quantity atau total_price kosong)'
      });
      return;
    }
    
    cleaned.push({
      transaction_id: row.transaction_id,
      product_id: row.product_id,
      product_name: row.product_name,
      region_id: row.region_id,
      region_name: row.region_name,
      date: new Date(date),
      quantity: quantity,
      price_per_unit: price,
      total_price: total
    });
  });
  
  return { cleaned, skipped };
}

// Analisis: Top 5 Produk
function getTopProducts(data) {
  const productSales = {};
  
  data.forEach(row => {
    if (!productSales[row.product_name]) {
      productSales[row.product_name] = 0;
    }
    productSales[row.product_name] += row.total_price;
  });
  
  return Object.entries(productSales)
    .map(([name, total]) => ({ name, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

// Analisis: Penjualan per Wilayah
function getSalesByRegion(data) {
  const regionSales = {};
  
  data.forEach(row => {
    if (!regionSales[row.region_name]) {
      regionSales[row.region_name] = 0;
    }
    regionSales[row.region_name] += row.total_price;
  });
  
  return Object.entries(regionSales)
    .map(([name, total]) => ({ name, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total);
}

// Analisis: Penjualan per Bulan
function getSalesByMonth(data) {
  const monthlySales = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  data.forEach(row => {
    const month = row.date.getMonth();
    const monthKey = monthNames[month];
    
    if (!monthlySales[monthKey]) {
      monthlySales[monthKey] = 0;
    }
    monthlySales[monthKey] += row.total_price;
  });
  
  return monthNames
    .filter(month => monthlySales[month])
    .map(month => ({
      month,
      total: Math.round(monthlySales[month])
    }));
}

// Analisis: Produk per Bulan
function getProductSalesByMonth(data) {
  const productMonthly = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
  
  data.forEach(row => {
    const month = row.date.getMonth();
    const monthKey = monthNames[month];
    const product = row.product_name;
    
    if (!productMonthly[product]) {
      productMonthly[product] = {};
    }
    if (!productMonthly[product][monthKey]) {
      productMonthly[product][monthKey] = 0;
    }
    productMonthly[product][monthKey] += row.total_price;
  });
  
  return monthNames.map(month => {
    const monthData = { month };
    Object.keys(productMonthly).forEach(product => {
      monthData[product] = Math.round(productMonthly[product][month] || 0);
    });
    return monthData;
  });
}

// Format angka ke Juta atau Ribu
function formatRupiah(value, decimals = 1) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)} Juta`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)} Ribu`;
  }
  return value.toFixed(0);
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export default function SalesDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [dataIssues, setDataIssues] = useState([]);
  const [skippedRecords, setSkippedRecords] = useState([]);
  const [showDataQuality, setShowDataQuality] = useState(false);

  useEffect(() => {
    const csvData = `transaction_id,product_id,product_name,region_id,region_name,date,quantity,price_per_unit,total_price
T9935,P001,Blender,R01,Jakarta,2024-06-22,3.0,456787,1370361.0
T4257,P001,Blender,R05,Makassar,2024-05-09,,233326,933304.0
T3615,P005,Electric Kettle,R04,Medan,2024-01-02,2.0,671029,1342058.0
T2584,P004,Air Purifier,R03,Surabaya,27-01-2024,3.0,363032,1089096.0
T7201,P003,Vacuum Cleaner,R03,Surabaya,2024-05-17,5.0,477370,2386850.0
T2139,P001,Blender,R05,Makassar,2024-05-27,3.0,859176,2577528.0
T6977,P001,Blender,R02,Bandung,2024-04-07,3.0,283667,851001.0
T3803,P002,Rice Cooker,R03,Surabaya,2024-06-23,3.0,419684,1259052.0
T4598,P005,Electric Kettle,R02,Bandung,2024-06-12,2.0,684714,1369428.0
T6155,P003,Vacuum Cleaner,R01,Jakarta,2024-01-17,2.0,233659,467318.0
T9830,P002,Rice Cooker,R04,Medan,2024-03-04,4.0,874079,3496316.0
T2489,P003,Vacuum Cleaner,R05,Makassar,2024-02-05,4.0,811878,3247512.0
T7252,P001,Blender,R01,Jakarta,01-06-2024,2.0,857924,1715848.0
T2876,P005,Electric Kettle,R04,Medan,2024-01-03,5.0,463626,2318130.0
T5315,P005,Electric Kettle,R03,Surabaya,2024-01-01,3.0,316970,950910.0
T4258,P005,Electric Kettle,R02,Bandung,2024-06-12,5.0,311579,1557895.0
T9005,P002,Rice Cooker,R03,Surabaya,2024-01-01,2.0,765579,1531158.0
T2403,P001,Blender,R01,Jakarta,2024-05-25,3.0,522451,1567353.0
T9645,P004,Air Purifier,R01,Jakarta,2024-05-20,5.0,331869,1659345.0
T7118,P005,Electric Kettle,R04,Medan,2024-03-20,2.0,765492,1530984.0
T4770,P004,Air Purifier,R05,Makassar,2024-01-06,4.0,326882,1307528.0
T6413,P005,Electric Kettle,R02,Bandung,2024-01-18,1.0,274441,274441.0
T8744,P001,Blender,R05,Makassar,2024-02-03,2.0,492004,984008.0
T8651,P002,Rice Cooker,R04,Medan,2024-03-31,4.0,399659,1598636.0
T4116,P001,Blender,R01,Jakarta,2024-01-28,1.0,622179,622179.0
T2604,P005,Electric Kettle,R04,Medan,2024-01-20,2.0,642374,1284748.0
T8886,P001,Blender,R05,Makassar,2024-02-12,1.0,297793,297793.0
T8454,P002,Rice Cooker,R04,Medan,2024-03-08,1.0,372634,372634.0
T1958,P003,Vacuum Cleaner,R04,Medan,2024-03-16,5.0,894022,4470110.0
T9701,P005,Electric Kettle,R05,Makassar,2024-05-02,1.0,984309,984309.0
T4853,P002,Rice Cooker,R01,Jakarta,2024-01-18,5.0,284002,1420010.0
T9565,P004,Air Purifier,R01,Jakarta,2024-01-21,5.0,458175,
T5915,P003,Vacuum Cleaner,R03,Surabaya,2024-04-11,2.0,902258,1804516.0
T4492,P004,Air Purifier,R03,Surabaya,26-01-2024,1.0,209767,209767.0
T8179,P005,Electric Kettle,R03,Surabaya,2024-04-04,2.0,565962,1131924.0
T2697,P005,Electric Kettle,R03,Surabaya,2024-05-21,5.0,885743,4428715.0
T6617,P002,Rice Cooker,R03,Surabaya,2024-03-13,1.0,312235,312235.0
T7939,P002,Rice Cooker,R03,Surabaya,14-01-2024,5.0,712262,3561310.0
T8239,P003,Vacuum Cleaner,R01,Jakarta,2024-03-08,1.0,549759,549759.0
T9938,P005,Electric Kettle,R04,Medan,2024-06-25,5.0,210139,1050695.0
T1653,P001,Blender,R03,Surabaya,2024-03-19,5.0,779364,3896820.0
T3532,P003,Vacuum Cleaner,R02,Bandung,2024-04-14,2.0,899330,1798660.0
T7745,P002,Rice Cooker,R02,Bandung,2024-03-26,,632322,1264644.0
T8541,P002,Rice Cooker,R03,Surabaya,2024-04-30,2.0,935343,1870686.0
T2137,P003,Vacuum Cleaner,R03,Surabaya,2024-03-25,,433752,867504.0
T2889,P003,Vacuum Cleaner,R03,Surabaya,2024-03-25,5.0,619093,3095465.0
T6139,P003,Vacuum Cleaner,R02,Bandung,2024-03-29,,478361,2391805.0
T8144,P004,Air Purifier,R05,Makassar,06-03-2024,5.0,321263,1606315.0
T8066,P001,Blender,R05,Makassar,2024-06-20,5.0,920221,4601105.0
T7691,P001,Blender,R03,Surabaya,2024-03-17,5.0,529164,2645820.0
T3851,P003,Vacuum Cleaner,R04,Medan,2024-04-07,3.0,781343,2344029.0
T6279,P005,Electric Kettle,R05,Makassar,2024-03-14,3.0,625800,
T5649,P004,Air Purifier,R04,Medan,2024-02-13,4.0,908446,3633784.0
T4262,P005,Electric Kettle,R05,Makassar,2024-06-21,3.0,297923,893769.0
T4185,P002,Rice Cooker,R01,Jakarta,2024-01-19,1.0,456736,456736.0
T4585,P004,Air Purifier,R04,Medan,2024-01-28,4.0,455836,1823344.0
T8612,P002,Rice Cooker,R05,Makassar,2024-02-01,4.0,252657,1010628.0
T9270,P005,Electric Kettle,R05,Makassar,2024-06-05,5.0,532711,2663555.0
T5543,P004,Air Purifier,R05,Makassar,2024-03-07,4.0,366889,1467556.0
T6238,P005,Electric Kettle,R04,Medan,2024-03-01,2.0,487936,975872.0
T7797,P005,Electric Kettle,R01,Jakarta,2024-06-29,2.0,358157,716314.0
T1320,P004,Air Purifier,R03,Surabaya,2024-04-17,5.0,688557,3442785.0
T7865,P005,Electric Kettle,R04,Medan,2024-04-09,4.0,206182,824728.0
T6507,P005,Electric Kettle,R05,Makassar,04-05-2024,5.0,431251,2156255.0
T1444,P004,Air Purifier,R02,Bandung,2024-04-10,4.0,333827,1335308.0
T6355,P001,Blender,R04,Medan,2024-03-24,2.0,684125,1368250.0
T9837,P003,Vacuum Cleaner,R04,Medan,2024-01-21,3.0,988539,2965617.0
T5051,P001,Blender,R03,Surabaya,2024-01-11,2.0,881725,1763450.0
T4571,P002,Rice Cooker,R01,Jakarta,2024-01-30,5.0,359784,1798920.0
T3683,P004,Air Purifier,R03,Surabaya,2024-01-30,3.0,375939,1127817.0
T4249,P003,Vacuum Cleaner,R01,Jakarta,2024-04-06,5.0,226925,1134625.0
T2983,P001,Blender,R05,Makassar,2024-06-24,2.0,306851,613702.0
T1207,P005,Electric Kettle,R01,Jakarta,2024-05-09,3.0,758623,2275869.0
T8135,P004,Air Purifier,R04,Medan,2024-04-27,1.0,654582,654582.0
T5397,P002,Rice Cooker,R05,Makassar,2024-05-03,3.0,845830,2537490.0
T7209,P003,Vacuum Cleaner,R02,Bandung,2024-04-28,1.0,492477,492477.0
T5526,P003,Vacuum Cleaner,R01,Jakarta,2024-03-07,4.0,540802,2163208.0
T4937,P005,Electric Kettle,R01,Jakarta,2024-05-05,5.0,400337,2001685.0
T7046,P004,Air Purifier,R04,Medan,2024-06-26,4.0,218080,872320.0
T8434,P004,Air Purifier,R05,Makassar,2024-03-25,5.0,560455,2802275.0
T4033,P003,Vacuum Cleaner,R03,Surabaya,2024-01-31,3.0,441736,1325208.0
T2647,P002,Rice Cooker,R02,Bandung,2024-05-14,4.0,489930,1959720.0
T1745,P002,Rice Cooker,R03,Surabaya,2024-05-16,2.0,578411,
T1200,P001,Blender,R05,Makassar,2024-05-05,3.0,931295,2793885.0
T8827,P005,Electric Kettle,R03,Surabaya,2024-01-14,4.0,701968,2807872.0
T5978,P001,Blender,R01,Jakarta,2024-01-14,4.0,715633,2862532.0
T9561,P001,Blender,R02,Bandung,2024-06-07,1.0,785181,785181.0
T1986,P004,Air Purifier,R04,Medan,2024-03-19,4.0,511797,2047188.0
T2229,P005,Electric Kettle,R01,Jakarta,2024-02-10,2.0,855900,1711800.0
T5632,P002,Rice Cooker,R01,Jakarta,2024-01-09,4.0,672387,2689548.0
T4241,P004,Air Purifier,R01,Jakarta,2024-06-18,2.0,477405,954810.0
T3718,P004,Air Purifier,R01,Jakarta,06-02-2024,5.0,435729,2178645.0
T5460,P003,Vacuum Cleaner,R05,Makassar,2024-03-18,5.0,502630,2513150.0
T5102,P005,Electric Kettle,R05,Makassar,2024-04-20,4.0,659023,
T5415,P001,Blender,R01,Jakarta,2024-01-06,2.0,907053,1814106.0
T8141,P005,Electric Kettle,R01,Jakarta,2024-03-12,2.0,693355,1386710.0
T6403,P004,Air Purifier,R01,Jakarta,2024-01-27,4.0,564863,2259452.0
T2442,P004,Air Purifier,R04,Medan,20-05-2024,3.0,894769,2684307.0
T1018,P003,Vacuum Cleaner,R03,Surabaya,2024-05-11,3.0,321552,964656.0
T1845,P005,Electric Kettle,R04,Medan,2024-05-07,4.0,256837,1027348.0
T1472,P002,Rice Cooker,R03,Surabaya,2024-06-27,5.0,337377,1686885.0
T2858,P005,Electric Kettle,R02,Bandung,2024-01-24,2.0,525845,1051690.0
T8905,P004,Air Purifier,R01,Jakarta,2024-06-29,2.0,722584,1445168.0
T3236,P004,Air Purifier,R02,Bandung,2024-06-02,4.0,778043,3112172.0
T5891,P001,Blender,R03,Surabaya,2024-01-01,4.0,556385,2225540.0
T9903,P005,Electric Kettle,R05,Makassar,2024-03-26,4.0,355813,1423252.0
T7730,P004,Air Purifier,R04,Medan,2024-04-08,3.0,397816,1193448.0
T3492,P001,Blender,R03,Surabaya,2024-06-18,4.0,939485,3757940.0
T8213,P004,Air Purifier,R01,Jakarta,2024-01-26,2.0,726690,1453380.0
T2225,P001,Blender,R05,Makassar,2024-06-16,4.0,216093,864372.0
T9742,P004,Air Purifier,R03,Surabaya,2024-03-25,3.0,853534,2560602.0
T5708,P004,Air Purifier,R03,Surabaya,2024-06-10,,767296,3069184.0
T5906,P002,Rice Cooker,R01,Jakarta,2024-01-26,4.0,303225,1212900.0
T7751,P001,Blender,R01,Jakarta,2024-02-07,3.0,258845,776535.0
T9153,P005,Electric Kettle,R02,Bandung,2024-06-07,2.0,383573,767146.0
T8622,P005,Electric Kettle,R02,Bandung,19-06-2024,2.0,683550,1367100.0
T7951,P003,Vacuum Cleaner,R05,Makassar,2024-05-30,2.0,277449,554898.0
T6881,P003,Vacuum Cleaner,R04,Medan,2024-01-28,3.0,408894,1226682.0
T1803,P005,Electric Kettle,R03,Surabaya,11-03-2024,3.0,223005,669015.0
T5106,P005,Electric Kettle,R04,Medan,2024-06-11,3.0,441296,1323888.0
T2476,P002,Rice Cooker,R01,Jakarta,2024-04-03,1.0,523939,
T5465,P003,Vacuum Cleaner,R03,Surabaya,2024-04-03,4.0,384171,1536684.0
T2233,P002,Rice Cooker,R03,Surabaya,2024-01-30,4.0,509478,2037912.0
T3024,P002,Rice Cooker,R02,Bandung,2024-01-04,4.0,784384,3137536.0
T4830,P004,Air Purifier,R03,Surabaya,2024-04-05,3.0,812955,2438865.0
T8606,P004,Air Purifier,R01,Jakarta,14-06-2024,5.0,788678,3943390.0
T4846,P003,Vacuum Cleaner,R04,Medan,2024-05-06,,346566,
T7866,P005,Electric Kettle,R02,Bandung,2024-06-27,4.0,675679,2702716.0
T5583,P005,Electric Kettle,R02,Bandung,2024-04-14,4.0,886735,3546940.0
T7018,P001,Blender,R03,Surabaya,02-04-2024,2.0,664920,1329840.0
T4475,P005,Electric Kettle,R03,Surabaya,26-04-2024,1.0,617479,617479.0
T4394,P005,Electric Kettle,R01,Jakarta,2024-05-24,1.0,549709,549709.0
T3370,P005,Electric Kettle,R02,Bandung,01-06-2024,2.0,544519,1089038.0
T4898,P002,Rice Cooker,R05,Makassar,03-02-2024,3.0,382973,1148919.0
T2041,P005,Electric Kettle,R03,Surabaya,2024-04-17,1.0,382710,382710.0
T1710,P004,Air Purifier,R04,Medan,2024-02-26,3.0,738169,2214507.0
T7984,P005,Electric Kettle,R03,Surabaya,2024-05-02,4.0,874591,3498364.0
T5505,P001,Blender,R04,Medan,07-02-2024,4.0,277060,1108240.0
T9282,P005,Electric Kettle,R05,Makassar,2024-05-15,5.0,946746,4733730.0
T4522,P005,Electric Kettle,R04,Medan,2024-05-21,1.0,935869,935869.0
T6120,P004,Air Purifier,R04,Medan,2024-04-16,2.0,633914,1267828.0
T2398,P004,Air Purifier,R03,Surabaya,01-05-2024,3.0,592483,1777449.0
T6400,P001,Blender,R04,Medan,22-05-2024,1.0,980758,980758.0
T6119,P001,Blender,R04,Medan,2024-01-14,3.0,897660,2692980.0
T6736,P003,Vacuum Cleaner,R01,Jakarta,2024-02-27,5.0,732060,3660300.0
T1430,P005,Electric Kettle,R03,Surabaya,2024-04-19,1.0,999649,999649.0
T3972,P005,Electric Kettle,R03,Surabaya,2024-03-27,1.0,389179,389179.0
T9691,P002,Rice Cooker,R05,Makassar,08-01-2024,4.0,272965,1091860.0
T2391,P002,Rice Cooker,R04,Medan,2024-03-24,4.0,675682,2702728.0
T7947,P001,Blender,R02,Bandung,2024-03-10,2.0,991083,1982166.0
T2816,P004,Air Purifier,R05,Makassar,2024-01-30,4.0,634303,2537212.0
T1897,P003,Vacuum Cleaner,R05,Makassar,2024-04-11,4.0,752530,
T1126,P001,Blender,R02,Bandung,2024-03-15,3.0,421494,1264482.0
T6802,P004,Air Purifier,R04,Medan,2024-05-08,2.0,335461,670922.0
T7626,P001,Blender,R04,Medan,2024-03-21,,657409,657409.0
T6928,P004,Air Purifier,R03,Surabaya,2024-06-07,,624707,624707.0
T6083,P001,Blender,R04,Medan,2024-01-21,1.0,455135,455135.0
T6724,P003,Vacuum Cleaner,R02,Bandung,2024-05-15,3.0,376299,1128897.0
T2234,P003,Vacuum Cleaner,R02,Bandung,2024-06-03,2.0,307798,615596.0
T6295,P002,Rice Cooker,R04,Medan,2024-06-23,4.0,991093,3964372.0
T6766,P003,Vacuum Cleaner,R02,Bandung,2024-03-11,4.0,271603,1086412.0
T2479,P005,Electric Kettle,R01,Jakarta,14-03-2024,3.0,684172,2052516.0
T4084,P005,Electric Kettle,R05,Makassar,2024-01-11,5.0,603159,3015795.0
T6626,P003,Vacuum Cleaner,R05,Makassar,2024-01-27,4.0,725721,2902884.0
T3600,P001,Blender,R05,Makassar,2024-04-22,2.0,241043,482086.0
T6482,P003,Vacuum Cleaner,R03,Surabaya,02-06-2024,3.0,606235,1818705.0
T3463,P001,Blender,R03,Surabaya,2024-06-17,1.0,785066,785066.0
T7421,P003,Vacuum Cleaner,R01,Jakarta,2024-06-16,5.0,895847,4479235.0
T9624,P002,Rice Cooker,R05,Makassar,2024-03-25,1.0,524620,524620.0
T8967,P001,Blender,R04,Medan,2024-02-24,,579404,2897020.0
T9843,P002,Rice Cooker,R02,Bandung,2024-01-26,2.0,362471,724942.0
T3712,P005,Electric Kettle,R01,Jakarta,2024-02-11,3.0,848052,2544156.0
T8355,P004,Air Purifier,R01,Jakarta,2024-04-23,4.0,581995,2327980.0
T8218,P002,Rice Cooker,R05,Makassar,2024-02-19,2.0,524500,1049000.0
T3267,P004,Air Purifier,R03,Surabaya,2024-02-21,4.0,727335,2909340.0
T5670,P003,Vacuum Cleaner,R01,Jakarta,2024-05-12,4.0,589244,2356976.0
T4637,P001,Blender,R02,Bandung,21-04-2024,3.0,671145,2013435.0
T2337,P004,Air Purifier,R03,Surabaya,2024-03-01,1.0,635050,635050.0
T3392,P003,Vacuum Cleaner,R02,Bandung,2024-06-15,1.0,534165,534165.0
T1086,P002,Rice Cooker,R01,Jakarta,2024-06-29,3.0,695404,2086212.0
T2821,P001,Blender,R01,Jakarta,2024-06-04,3.0,426130,1278390.0
T2816,P003,Vacuum Cleaner,R02,Bandung,2024-06-08,,327767,983301.0
T1025,P004,Air Purifier,R05,Makassar,2024-02-06,5.0,217233,1086165.0
T6908,P005,Electric Kettle,R03,Surabaya,2024-01-22,2.0,798384,1596768.0
T8702,P001,Blender,R05,Makassar,2024-01-06,5.0,731971,3659855.0
T2698,P001,Blender,R04,Medan,2024-01-18,3.0,465971,1397913.0
T8612,P005,Electric Kettle,R03,Surabaya,2024-06-13,2.0,246489,492978.0
T1717,P004,Air Purifier,R02,Bandung,2024-01-10,2.0,266165,532330.0
T1599,P002,Rice Cooker,R01,Jakarta,2024-05-19,3.0,525138,1575414.0
T8159,P002,Rice Cooker,R03,Surabaya,2024-02-01,3.0,250126,750378.0
T9507,P004,Air Purifier,R04,Medan,2024-05-07,4.0,555505,2222020.0
T6262,P003,Vacuum Cleaner,R01,Jakarta,2024-02-16,4.0,282760,1131040.0
T8272,P001,Blender,R01,Jakarta,2024-04-19,3.0,893024,2679072.0
T1939,P003,Vacuum Cleaner,R04,Medan,2024-04-21,1.0,962120,962120.0
T8179,P001,Blender,R04,Medan,2024-01-08,3.0,738009,2214027.0
T1530,P001,Blender,R02,Bandung,2024-04-08,1.0,447459,447459.0
T7012,P005,Electric Kettle,R02,Bandung,2024-05-26,4.0,588984,2355936.0
T7340,P004,Air Purifier,R03,Surabaya,2024-02-17,3.0,461736,
T9047,P005,Electric Kettle,R01,Jakarta,2024-06-05,3.0,472933,1418799.0
T6236,P002,Rice Cooker,R01,Jakarta,2024-04-23,2.0,277649,555298.0
T8141,P005,Electric Kettle,R01,Jakarta,2024-03-12,2.0,693355,1386710.0
T4258,P005,Electric Kettle,R02,Bandung,2024-06-12,5.0,311579,1557895.0
T4853,P002,Rice Cooker,R01,Jakarta,2024-01-18,5.0,284002,1420010.0
T2234,P003,Vacuum Cleaner,R02,Bandung,2024-06-03,2.0,307798,615596.0
T5583,P005,Electric Kettle,R02,Bandung,2024-04-14,4.0,886735,3546940.0`;

    const parsed = parseCSV(csvData);
    
    const issues = identifyDataIssues(parsed);
    setDataIssues(issues);
    
    const { cleaned, skipped } = cleanData(parsed);
    setData(cleaned);
    setSkippedRecords(skipped);
    
    const totalSales = cleaned.reduce((sum, row) => sum + row.total_price, 0);
    const totalTransactions = cleaned.length;
    const avgTransaction = totalSales / totalTransactions;
    
    setStats({
      totalSales: Math.round(totalSales),
      totalTransactions,
      avgTransaction: Math.round(avgTransaction),
      totalRawRecords: parsed.length,
      totalIssues: issues.length,
      totalSkipped: skipped.length,
      dataQualityRate: ((cleaned.length / parsed.length) * 100).toFixed(1)
    });
    
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700">Memuat data...</div>
        </div>
      </div>
    );
  }

  const topProducts = getTopProducts(data);
  const salesByRegion = getSalesByRegion(data);
  const salesByMonth = getSalesByMonth(data);
  const productSalesByMonth = getProductSalesByMonth(data);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">
                Dashboard Analisis Penjualan 2024
              </h1>
              <p className="text-blue-100 text-lg">
                Insight berbasis data untuk pengambilan keputusan strategis
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/20">
              <div className="text-sm text-blue-100">Periode Analisis</div>
              <div className="text-xl font-bold">Jan - Jun 2024</div>
            </div>
          </div>
        </div>

        {/* Data Quality Alert */}
        {(dataIssues.length > 0 || skippedRecords.length > 0) && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 p-5 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500 p-3 rounded-full">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yellow-900">
                    Ditemukan Masalah Kualitas Data
                  </h3>
                  <p className="text-sm text-yellow-800 mt-1">
                    {dataIssues.length} baris dengan masalah, {skippedRecords.length} baris di-skip dari analisis
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDataQuality(!showDataQuality)}
                className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                {showDataQuality ? 'Sembunyikan Detail' : 'Lihat Detail'}
              </button>
            </div>
          </div>
        )}

        {/* Data Quality Details */}
        {showDataQuality && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <XCircle className="h-7 w-7 text-red-600" />
              </div>
              Laporan Kualitas Data
            </h2>
            
            {/* Quality Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 hover:shadow-lg transition-shadow">
                <div className="text-sm text-blue-700 font-semibold mb-2">Total Record</div>
                <div className="text-3xl font-bold text-blue-800">{stats.totalRawRecords}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200 hover:shadow-lg transition-shadow">
                <div className="text-sm text-green-700 font-semibold mb-2">Data Valid</div>
                <div className="text-3xl font-bold text-green-800">{stats.totalTransactions}</div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200 hover:shadow-lg transition-shadow">
                <div className="text-sm text-red-700 font-semibold mb-2">Data Di-skip</div>
                <div className="text-3xl font-bold text-red-800">{stats.totalSkipped}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 hover:shadow-lg transition-shadow">
                <div className="text-sm text-purple-700 font-semibold mb-2">Tingkat Kualitas</div>
                <div className="text-3xl font-bold text-purple-800">{stats.dataQualityRate}%</div>
              </div>
            </div>

            {/* Issues Found */}
            {dataIssues.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Masalah Ditemukan ({dataIssues.length} baris)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Baris</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID Transaksi</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wilayah</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Masalah</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dataIssues.slice(0, 20).map((issue, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-mono">#{issue.lineNumber}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-mono">{issue.transactionId}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700">{issue.product}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700">{issue.region}</td>
                          <td className="px-4 py-2 text-gray-600">
                            <ul className="list-disc list-inside">
                              {issue.problems.map((prob, i) => (
                                <li key={i} className="text-xs">{prob}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dataIssues.length > 20 && (
                    <div className="text-center py-2 text-sm text-gray-500">
                      ... dan {dataIssues.length - 20} masalah lainnya
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Skipped Records */}
            {skippedRecords.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Data yang Di-skip dari Analisis ({skippedRecords.length} baris)
                </h3>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-700 mb-3">
                    Baris berikut di-skip karena data kritis tidak lengkap (quantity atau total_price kosong):
                  </p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {skippedRecords.map((record, idx) => (
                      <div key={idx} className="text-xs text-red-600 font-mono bg-white px-3 py-1 rounded">
                        {record.transactionId} - {record.reason}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="mt-6 bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Rekomendasi Perbaikan Data</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                <li>Standarisasi format tanggal menjadi YYYY-MM-DD untuk semua entry</li>
                <li>Pastikan field quantity dan total_price selalu terisi</li>
                <li>Implementasi validasi perhitungan (quantity × price = total) di sistem input</li>
                <li>Lakukan data cleaning secara berkala untuk menjaga kualitas data</li>
                <li>Buat SOP pengisian data yang jelas untuk mencegah error di masa depan</li>
              </ul>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-blue-100">Total Penjualan</div>
              <div className="bg-white/20 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold mb-1">
              Rp {(stats.totalSales / 1000000).toFixed(1)} Juta
            </div>
            <div className="text-blue-100 text-sm">Semester 1 2024</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-green-100">Total Transaksi Valid</div>
              <div className="bg-white/20 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold mb-1">{stats.totalTransactions}</div>
            <div className="text-green-100 text-sm">dari {stats.totalRawRecords} total record</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-purple-100">Rata-rata per Transaksi</div>
              <div className="bg-white/20 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold mb-1">
              Rp {(stats.avgTransaction / 1000).toFixed(0)} Ribu
            </div>
            <div className="text-purple-100 text-sm">Per transaksi</div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Products */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Top 5 Produk dengan Penjualan Tertinggi
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} style={{ fontSize: '12px' }} />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)} Juta`} style={{ fontSize: '12px' }} />
                <Tooltip 
                  formatter={(value) => [`Rp ${formatRupiah(value)}`, 'Total Penjualan']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="total" fill="url(#colorBlue)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sales by Region - Pie Chart */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Penjualan per Wilayah
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={salesByRegion}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${(entry.total / 1000000).toFixed(1)} Juta`}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {salesByRegion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`Rp ${formatRupiah(value)}`, 'Total Penjualan']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6">
          {/* Monthly Sales Trend */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Trend Penjualan Bulanan (Januari - Juni 2024)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)} Juta`} style={{ fontSize: '12px' }} />
                <Tooltip 
                  formatter={(value) => [`Rp ${formatRupiah(value)}`, 'Total Penjualan']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} name="Total Penjualan" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Product Sales by Month */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Penjualan per Produk per Bulan
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={productSalesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)} Juta`} style={{ fontSize: '12px' }} />
                <Tooltip 
                  formatter={(value) => [`Rp ${formatRupiah(value)}`, '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Line type="monotone" dataKey="Electric Kettle" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Vacuum Cleaner" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Blender" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Air Purifier" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Rice Cooker" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Ringkasan Penjualan per Wilayah
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peringkat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wilayah
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Penjualan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Persentase
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salesByRegion.map((region, index) => (
                  <tr key={region.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {region.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Rp {(region.total / 1000000).toFixed(2)} Juta
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow bg-gray-200 rounded-full h-2 max-w-xs">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${((region.total / stats.totalSales) * 100).toFixed(1)}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold">{((region.total / stats.totalSales) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights & Recommendations */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-6 text-gray-800">
            Insight dan Kesimpulan
          </h2>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg">
              <h3 className="font-semibold text-gray-800 mb-2">1. Produk Terlaris</h3>
              <p className="text-gray-700 text-sm">
                <strong>Electric Kettle</strong> menjadi produk dengan penjualan tertinggi, diikuti oleh 
                <strong> Vacuum Cleaner</strong> dan <strong>Blender</strong>. Ketiga produk ini berkontribusi 
                lebih dari 60% terhadap total penjualan perusahaan.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded-r-lg">
              <h3 className="font-semibold text-gray-800 mb-2">2. Performa Wilayah</h3>
              <p className="text-gray-700 text-sm">
                <strong>Surabaya</strong> merupakan wilayah dengan permintaan tertinggi, mencatat penjualan 
                sekitar {((salesByRegion[0]?.total / stats.totalSales) * 100).toFixed(1)}% dari total penjualan. 
                Diikuti oleh <strong>Jakarta</strong> dan <strong>Medan</strong> sebagai wilayah dengan potensi besar.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-50 rounded-r-lg">
              <h3 className="font-semibold text-gray-800 mb-2">3. Trend Penjualan</h3>
              <p className="text-gray-700 text-sm">
                Penjualan menunjukkan tren positif dengan peningkatan signifikan pada periode 
                <strong> April-Juni 2024</strong>. Bulan Mei dan Juni mencatat penjualan tertinggi, 
                menunjukkan adanya seasonality dalam pola pembelian konsumen.
              </p>
            </div>

            <div className="border-l-4 border-orange-500 pl-4 py-2 bg-orange-50 rounded-r-lg">
              <h3 className="font-semibold text-gray-800 mb-2">4. Pola Produk per Bulan</h3>
              <p className="text-gray-700 text-sm">
                Electric Kettle dan Vacuum Cleaner menunjukkan pertumbuhan konsisten sepanjang semester pertama. 
                Semua produk mengalami kenaikan penjualan menjelang pertengahan tahun, mengindikasikan 
                adanya momen pembelian yang perlu dimanfaatkan.
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-xl p-6 border border-blue-100">
          <h2 className="text-xl font-bold mb-6 text-gray-800">
            Rekomendasi Strategis
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <div className="text-2xl">📦</div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Manajemen Stok</h3>
                  <p className="text-sm text-gray-600">
                    Tingkatkan stok Electric Kettle dan Vacuum Cleaner sebagai prioritas utama. 
                    Pastikan ketersediaan di wilayah Surabaya dan Jakarta.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="bg-green-100 p-3 rounded-lg">
                  <div className="text-2xl">🎯</div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Fokus Geografis</h3>
                  <p className="text-sm text-gray-600">
                    Alokasikan lebih banyak resources untuk wilayah Surabaya dan Jakarta. 
                    Tingkatkan aktivitas promosi di Bandung dan Makassar untuk meningkatkan market share.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <div className="text-2xl">📅</div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Strategi Seasonal</h3>
                  <p className="text-sm text-gray-600">
                    Persiapkan kampanye marketing intensif menjelang periode April-Juni. 
                    Manfaatkan momentum kenaikan penjualan dengan promo bundling produk.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <div className="text-2xl">🚀</div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Diversifikasi Produk</h3>
                  <p className="text-sm text-gray-600">
                    Pertimbangkan menambah varian Electric Kettle dan accessories pendukung. 
                    Lakukan riset pasar untuk produk elektronik rumah tangga lainnya.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl p-6 text-center border border-gray-300">
          <p className="text-sm text-gray-700 leading-relaxed">
            Dashboard ini dihasilkan dari analisis <strong>{stats.totalTransactions}</strong> transaksi valid 
            (dari <strong>{stats.totalRawRecords}</strong> total record) dengan total penjualan <strong>Rp {(stats.totalSales / 1000000).toFixed(1)} Juta</strong>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Periode: Januari - Juni 2024 | Tingkat Kualitas Data: <strong>{stats.dataQualityRate}%</strong>
          </p>
        </div>
      </div>
    </div>
  );
}