"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  User,
  Stethoscope,
  Pill,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Prescriber {
  id: string;
  name: string;
  registrationNumber: string;
  councilType: string;
  facility: string | null;
  specialization: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
}

interface PrescriptionItem {
  medicineName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  quantityPrescribed: number;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  substitutionAllowed: boolean;
  isControlled: boolean;
  scheduleClass: string;
}

const DOSAGE_FORMS = [
  "TABLET", "CAPSULE", "SYRUP", "SUSPENSION", "INJECTION", "CREAM",
  "OINTMENT", "GEL", "DROPS", "INHALER", "PATCH", "SUPPOSITORY", "OTHER"
];

const FREQUENCIES = [
  { value: "OD", label: "OD - Once daily" },
  { value: "BD", label: "BD - Twice daily" },
  { value: "TDS", label: "TDS - Three times daily" },
  { value: "QID", label: "QID - Four times daily" },
  { value: "STAT", label: "STAT - Immediately" },
  { value: "PRN", label: "PRN - As needed" },
  { value: "HS", label: "HS - At bedtime" },
  { value: "AC", label: "AC - Before meals" },
  { value: "PC", label: "PC - After meals" },
  { value: "Q4H", label: "Q4H - Every 4 hours" },
  { value: "Q6H", label: "Q6H - Every 6 hours" },
  { value: "Q8H", label: "Q8H - Every 8 hours" },
  { value: "Q12H", label: "Q12H - Every 12 hours" },
  { value: "WEEKLY", label: "Weekly" },
];

const ROUTES = [
  "ORAL", "IV", "IM", "SC", "TOPICAL", "RECTAL", "VAGINAL",
  "INHALATION", "OPHTHALMIC", "OTIC", "NASAL", "SUBLINGUAL", "OTHER"
];

const SCHEDULE_CLASSES = [
  { value: "", label: "Not Controlled" },
  { value: "SCHEDULE_I", label: "Schedule I (Highest Control)" },
  { value: "SCHEDULE_II", label: "Schedule II" },
  { value: "SCHEDULE_III", label: "Schedule III" },
  { value: "SCHEDULE_IV", label: "Schedule IV" },
  { value: "SCHEDULE_V", label: "Schedule V (Lowest Control)" },
];

export default function NewPrescriptionContent() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [prescribers, setPrescribers] = useState<Prescriber[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  // Form state
  const [prescriberId, setPrescriberId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [refillsAllowed, setRefillsAllowed] = useState(0);
  const [prescriptionNotes, setPrescriptionNotes] = useState("");

  const [items, setItems] = useState<PrescriptionItem[]>([
    {
      medicineName: "",
      genericName: "",
      strength: "",
      dosageForm: "TABLET",
      quantityPrescribed: 0,
      dosage: "1 tablet",
      frequency: "TDS",
      duration: "7 days",
      route: "ORAL",
      instructions: "",
      substitutionAllowed: true,
      isControlled: false,
      scheduleClass: "",
    },
  ]);

  // Fetch prescribers
  useEffect(() => {
    const fetchPrescribers = async () => {
      try {
        const res = await fetch("/api/prescribers?all=true");
        const data = await res.json();
        if (res.ok) {
          setPrescribers(data.prescribers);
        }
      } catch {
        console.error("Failed to fetch prescribers");
      }
    };
    fetchPrescribers();
  }, []);

  // Search customers
  useEffect(() => {
    const searchCustomers = async () => {
      if (customerSearch.length < 2) {
        setCustomers([]);
        return;
      }
      setSearchingCustomers(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=10`);
        const data = await res.json();
        if (res.ok) {
          setCustomers(data.customers);
        }
      } catch {
        console.error("Failed to search customers");
      } finally {
        setSearchingCustomers(false);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch]);

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setPatientName(customer.name);
    setPatientPhone(customer.phone);
    setPatientGender(customer.gender || "");
    setPatientAddress(customer.address || "");
    if (customer.dateOfBirth) {
      const age = Math.floor(
        (Date.now() - new Date(customer.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      setPatientAge(age.toString());
    }
    setCustomerSearch("");
    setCustomers([]);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        medicineName: "",
        genericName: "",
        strength: "",
        dosageForm: "TABLET",
        quantityPrescribed: 0,
        dosage: "1 tablet",
        frequency: "TDS",
        duration: "7 days",
        route: "ORAL",
        instructions: "",
        substitutionAllowed: true,
        isControlled: false,
        scheduleClass: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof PrescriptionItem, value: unknown) => {
    const newItems = [...items];
    (newItems[index] as unknown as Record<string, unknown>)[field] = value;
    
    // If marking as controlled, set default schedule
    if (field === "isControlled" && value === true && !newItems[index].scheduleClass) {
      newItems[index].scheduleClass = "SCHEDULE_III";
      // Controlled substances typically have shorter validity
      setExpiryDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      setRefillsAllowed(0);
    }
    
    setItems(newItems);
  };

  const handleSubmit = async () => {
    // Validation
    if (!prescriberId) {
      toast.error("Please select a prescriber");
      return;
    }
    if (!patientName) {
      toast.error("Please enter patient name");
      return;
    }
    if (!expiryDate) {
      toast.error("Please set prescription expiry date");
      return;
    }
    if (items.some(item => !item.medicineName || item.quantityPrescribed <= 0)) {
      toast.error("Please fill in all medicine details with valid quantities");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriberId,
          customerId: customerId || null,
          patientName,
          patientPhone,
          patientAge: patientAge ? parseInt(patientAge) : null,
          patientGender,
          patientAddress,
          diagnosis,
          priority,
          issueDate,
          expiryDate,
          refillsAllowed,
          prescriptionNotes,
          items,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Prescription ${data.prescription.prescriptionNumber} created`);
        router.push("/prescriptions");
      } else {
        toast.error(data.error || "Failed to create prescription");
      }
    } catch {
      toast.error("Failed to create prescription");
    } finally {
      setSaving(false);
    }
  };

  const hasControlledItems = items.some(item => item.isControlled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/prescriptions">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Prescription</h1>
          <p className="text-gray-500">Enter prescription details for dispensing</p>
        </div>
      </div>

      {hasControlledItems && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-800">Controlled Substance Prescription</h4>
            <p className="text-sm text-purple-700">
              This prescription contains controlled substances. Per Kenya Poisons Act, validity is limited to 7 days and refills are not allowed.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Patient & Prescriber */}
        <div className="space-y-6">
          {/* Prescriber Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="w-5 h-5" />
                Prescriber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={prescriberId} onValueChange={setPrescriberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prescriber" />
                </SelectTrigger>
                <SelectContent>
                  {prescribers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div>
                        <div>{p.name}</div>
                        <div className="text-xs text-gray-500">
                          {p.councilType}: {p.registrationNumber}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {prescribers.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  No prescribers found. <Link href="/prescribers" className="text-emerald-600 hover:underline">Add a prescriber</Link> first.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Search */}
              <div className="space-y-2">
                <Label>Search Existing Customer</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searchingCustomers && (
                  <p className="text-sm text-gray-500">Searching...</p>
                )}
                {customers.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-gray-500">{c.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name *</Label>
                  <Input
                    id="patientName"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="patientAge">Age</Label>
                    <Input
                      id="patientAge"
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="Years"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientGender">Gender</Label>
                    <Select value={patientGender} onValueChange={setPatientGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientPhone">Phone</Label>
                  <Input
                    id="patientPhone"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="+254 700 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnosis</Label>
                  <Input
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="ICD-10 code or description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prescription Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prescription Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="STAT">STAT (Immediate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date *</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refillsAllowed">Refills Allowed</Label>
                <Input
                  id="refillsAllowed"
                  type="number"
                  min="0"
                  max="12"
                  value={refillsAllowed}
                  onChange={(e) => setRefillsAllowed(parseInt(e.target.value) || 0)}
                  disabled={hasControlledItems}
                />
                {hasControlledItems && (
                  <p className="text-xs text-purple-600">Refills not allowed for controlled substances</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriptionNotes">Prescriber Notes</Label>
                <Textarea
                  id="prescriptionNotes"
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  placeholder="Additional instructions from prescriber"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Medicines */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pill className="w-5 h-5" />
                Prescribed Medicines
              </CardTitle>
              <Button onClick={addItem} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Medicine
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {items.map((item, index) => (
                <div key={index} className={`p-4 border rounded-lg space-y-4 ${
                  item.isControlled ? "border-purple-300 bg-purple-50" : ""
                }`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Medicine #{index + 1}</h4>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Medicine Name *</Label>
                      <Input
                        value={item.medicineName}
                        onChange={(e) => updateItem(index, "medicineName", e.target.value)}
                        placeholder="e.g., Amoxicillin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Generic Name</Label>
                      <Input
                        value={item.genericName}
                        onChange={(e) => updateItem(index, "genericName", e.target.value)}
                        placeholder="e.g., Amoxicillin trihydrate"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Strength</Label>
                      <Input
                        value={item.strength}
                        onChange={(e) => updateItem(index, "strength", e.target.value)}
                        placeholder="e.g., 500mg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label>Form</Label>
                      <Select
                        value={item.dosageForm}
                        onValueChange={(v) => updateItem(index, "dosageForm", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOSAGE_FORMS.map((form) => (
                            <SelectItem key={form} value={form}>{form}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantityPrescribed || ""}
                        onChange={(e) => updateItem(index, "quantityPrescribed", parseInt(e.target.value) || 0)}
                        placeholder="e.g., 21"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dosage *</Label>
                      <Input
                        value={item.dosage}
                        onChange={(e) => updateItem(index, "dosage", e.target.value)}
                        placeholder="e.g., 1 tablet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency *</Label>
                      <Select
                        value={item.frequency}
                        onValueChange={(v) => updateItem(index, "frequency", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCIES.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Input
                        value={item.duration}
                        onChange={(e) => updateItem(index, "duration", e.target.value)}
                        placeholder="e.g., 7 days"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Route</Label>
                      <Select
                        value={item.route}
                        onValueChange={(v) => updateItem(index, "route", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROUTES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Instructions</Label>
                      <Input
                        value={item.instructions}
                        onChange={(e) => updateItem(index, "instructions", e.target.value)}
                        placeholder="e.g., Take with food"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sub-${index}`}
                        checked={item.substitutionAllowed}
                        onCheckedChange={(c) => updateItem(index, "substitutionAllowed", c)}
                      />
                      <Label htmlFor={`sub-${index}`} className="text-sm">Allow generic substitution</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`ctrl-${index}`}
                        checked={item.isControlled}
                        onCheckedChange={(c) => updateItem(index, "isControlled", c)}
                      />
                      <Label htmlFor={`ctrl-${index}`} className="text-sm text-purple-700">Controlled Substance</Label>
                    </div>
                    {item.isControlled && (
                      <div className="space-y-2">
                        <Select
                          value={item.scheduleClass}
                          onValueChange={(v) => updateItem(index, "scheduleClass", v)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Schedule Class" />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_CLASSES.filter(s => s.value).map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link href="/prescriptions">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Creating..." : "Create Prescription"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
