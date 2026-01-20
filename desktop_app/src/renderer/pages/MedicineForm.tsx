import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Package,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader } from '../components/ui';
import { useNavigate, useParams } from 'react-router-dom';

const CATEGORIES = [
  'Tablets',
  'Capsules',
  'Syrups',
  'Injections',
  'Topicals',
  'Drops',
  'Inhalers',
  'Supplements',
  'Medical Devices',
  'Other',
];

interface MedicineFormData {
  name: string;
  genericName: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  reorderLevel: string;
  unitPrice: string;
  costPrice: string;
  category: string;
  description: string;
}

export default function MedicineForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(isEditing);
  const [formData, setFormData] = useState<MedicineFormData>({
    name: '',
    genericName: '',
    manufacturer: '',
    batchNumber: '',
    expiryDate: '',
    quantity: '',
    reorderLevel: '10',
    unitPrice: '',
    costPrice: '',
    category: 'Tablets',
    description: '',
  });
  const [errors, setErrors] = useState<Partial<MedicineFormData>>({});

  useEffect(() => {
    if (isEditing && id) {
      fetchMedicine(id);
    }
  }, [id, isEditing]);

  const fetchMedicine = async (medicineId: string) => {
    try {
      const result = await window.electronAPI.getMedicineById(medicineId);
      if (result.success && result.medicine) {
        const m = result.medicine;
        setFormData({
          name: m.name || '',
          genericName: m.genericName || '',
          manufacturer: m.manufacturer || '',
          batchNumber: m.batchNumber || '',
          expiryDate: m.expiryDate ? m.expiryDate.split('T')[0] : '',
          quantity: m.quantity?.toString() || '',
          reorderLevel: m.reorderLevel?.toString() || '10',
          unitPrice: m.unitPrice?.toString() || '',
          costPrice: m.costPrice?.toString() || '',
          category: m.category || 'Tablets',
          description: m.description || '',
        });
      } else {
        alert('Medicine not found');
        navigate('/inventory');
      }
    } catch (error) {
      console.error('Error fetching medicine:', error);
      alert('Failed to load medicine');
      navigate('/inventory');
    } finally {
      setFetchingData(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<MedicineFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.batchNumber.trim()) {
      newErrors.batchNumber = 'Batch number is required';
    }
    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else {
      const expiry = new Date(formData.expiryDate);
      if (expiry <= new Date()) {
        newErrors.expiryDate = 'Expiry date must be in the future';
      }
    }
    if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
      newErrors.unitPrice = 'Valid unit price is required';
    }
    if (!formData.quantity || parseInt(formData.quantity) < 0) {
      newErrors.quantity = 'Valid quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const data = {
        name: formData.name.trim(),
        genericName: formData.genericName.trim() || undefined,
        manufacturer: formData.manufacturer.trim() || undefined,
        batchNumber: formData.batchNumber.trim(),
        expiryDate: formData.expiryDate,
        quantity: parseInt(formData.quantity) || 0,
        reorderLevel: parseInt(formData.reorderLevel) || 10,
        unitPrice: parseFloat(formData.unitPrice),
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        category: formData.category,
        description: formData.description.trim() || undefined,
      };

      let result;
      if (isEditing && id) {
        result = await window.electronAPI.updateMedicine(id, data);
      } else {
        result = await window.electronAPI.createMedicine(data);
      }

      if (result.success) {
        alert(isEditing ? 'Medicine updated successfully!' : 'Medicine added successfully!');
        navigate('/inventory');
      } else {
        alert(result.error || 'Failed to save medicine');
      }
    } catch (error) {
      console.error('Error saving medicine:', error);
      alert('Failed to save medicine');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof MedicineFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (fetchingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/inventory')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Medicine' : 'Add Medicine'}
                </h1>
                <p className="text-sm text-gray-500">
                  {isEditing ? 'Update medicine information' : 'Add a new medicine to inventory'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900">Medicine Information</h3>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medicine Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., Paracetamol 500mg"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Generic Name
                  </label>
                  <Input
                    value={formData.genericName}
                    onChange={(e) => handleChange('genericName', e.target.value)}
                    placeholder="e.g., Acetaminophen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) => handleChange('manufacturer', e.target.value)}
                    placeholder="e.g., GSK"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Batch & Expiry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Batch Number *
                  </label>
                  <Input
                    value={formData.batchNumber}
                    onChange={(e) => handleChange('batchNumber', e.target.value)}
                    placeholder="e.g., BTH-2024-001"
                    className={errors.batchNumber ? 'border-red-500' : ''}
                    disabled={isEditing}
                  />
                  {errors.batchNumber && (
                    <p className="text-red-500 text-xs mt-1">{errors.batchNumber}</p>
                  )}
                  {isEditing && (
                    <p className="text-gray-500 text-xs mt-1">Batch number cannot be changed</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => handleChange('expiryDate', e.target.value)}
                    className={errors.expiryDate ? 'border-red-500' : ''}
                  />
                  {errors.expiryDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>
                  )}
                </div>
              </div>

              {/* Stock & Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                    placeholder="0"
                    min="0"
                    className={errors.quantity ? 'border-red-500' : ''}
                  />
                  {errors.quantity && (
                    <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reorder Level
                  </label>
                  <Input
                    type="number"
                    value={formData.reorderLevel}
                    onChange={(e) => handleChange('reorderLevel', e.target.value)}
                    placeholder="10"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price (KES) *
                  </label>
                  <Input
                    type="number"
                    value={formData.unitPrice}
                    onChange={(e) => handleChange('unitPrice', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={errors.unitPrice ? 'border-red-500' : ''}
                  />
                  {errors.unitPrice && (
                    <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Price (KES)
                  </label>
                  <Input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => handleChange('costPrice', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Additional notes about this medicine..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => navigate('/inventory')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isEditing ? 'Update Medicine' : 'Add Medicine'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
