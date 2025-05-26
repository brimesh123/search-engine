import React, { useState, useEffect } from 'react';
import { Search, FileText, Package, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001/api';

const ItemManagementApp = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // Search for main items
  const searchMainItems = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/search/main-items?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError('Error searching items');
    }
  };

  // Get BOM for selected item
  const getBOM = async (itemNo) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/main-items/${itemNo}/bom`);
      
      if (!response.ok) {
        throw new Error('Item not found');
      }
      
      const data = await response.json();
      setBomData(data);
      setSelectedItem(data.mainItem);
      setSearchResults([]); // Clear search results after successful search
    } catch (err) {
      console.error('BOM fetch error:', err);
      setError('Error fetching item details. Please check if the item exists.');
      setBomData(null);
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input changes
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery) {
        searchMainItems(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  // Handle search form submission
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      getBOM(searchQuery.trim());
    }
  };

  // Download BOM report
  const downloadReport = async () => {
    if (!selectedItem) return;

    try {
      const response = await fetch(`${API_BASE_URL}/reports/bom/${selectedItem.item_no}`);
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOM_${selectedItem.item_no}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Error downloading report');
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadStatus('uploading');

    try {
      const response = await fetch(`${API_BASE_URL}/upload-excel`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        setUploadStatus('success');
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Item Management System</h1>
                <p className="text-gray-500">Search and manage Bill of Materials</p>
              </div>
            </div>
            
            {/* File Upload */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg cursor-pointer transition-colors">
                <Upload className="h-4 w-4" />
                <span>Upload Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              
              {uploadStatus && (
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                  uploadStatus === 'success' ? 'bg-green-100 text-green-700' :
                  uploadStatus === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {uploadStatus === 'success' && <CheckCircle className="h-4 w-4" />}
                  {uploadStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                  <span>
                    {uploadStatus === 'uploading' && 'Uploading...'}
                    {uploadStatus === 'success' && 'Upload successful!'}
                    {uploadStatus === 'error' && 'Upload failed'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter Main Item ID (e.g., FG1888)"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
              />
            </div>
            
            {/* Search Suggestions */}
            {searchResults.length > 0 && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSearchQuery(item.item_no);
                      setSearchResults([]);
                      getBOM(item.item_no);
                    }}
                    className="p-3 hover:bg-white cursor-pointer border-b border-gray-200 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{item.item_no}</div>
                    <div className="text-sm text-gray-500 truncate">{item.item_name}</div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  <span>Search Item</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {bomData && selectedItem && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Main Item Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Main Item: {selectedItem.item_no}</h2>
                  <p className="text-blue-100 text-lg">{selectedItem.item_name}</p>
                </div>
                <button
                  onClick={downloadReport}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Components</h3>
                <p className="text-2xl font-bold text-gray-900">{bomData.totalComponents}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Quantity</h3>
                <p className="text-2xl font-bold text-gray-900">{bomData.totalQuantity}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Item Type</h3>
                <p className="text-2xl font-bold text-gray-900">Assembly</p>
              </div>
            </div>

            {/* BOM Table */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Required Sub-Items
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Item No</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bomData.childItems.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">
                          {item.child_item_no}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {item.child_item_name}
                        </td>
                        <td className="px-4 py-4 text-sm text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.item_relation === 'I' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {item.item_relation === 'I' ? 'Item' : 'Reference'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Item Management System - Built with React, Node.js, and MySQL</p>
        </div>
      </div>
    </div>
  );
};

export default ItemManagementApp;