import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_CONFIG } from "../../config";
import { MedicalImageUpload } from "./MedicalImageUpload";

interface User {
  id: string;
  name: string | null;
  email: string | null;
}

interface Room {
  id: string;
  name?: string;
  status: "active" | "closed";
  messages: Message[];
  guest: User | null;
  activeAgents: User[];
  medicalData?: {
    pregnancyStatus?: string;
    conditions?: Record<string, string>;
    medications?: Record<string, string>;
    allergies?: Record<string, string>;
    bloodType?: string;
    lastVisitDate?: string;
  };
  visits?: {
    id: string;
    scheduledTime: string;
    status: "scheduled" | "completed" | "cancelled";
    notes?: string;
    createdAt: string;
  }[];
  reminders?: {
    id: string;
    message: string;
    scheduledTime: string;
    createdAt: string;
  }[];
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  sender: User | null;
  senderType: string;
  taggedAgents: User[];
}

const MedicalForm = ({
  room,
  onClose,
  onSave,
}: {
  room: Room;
  onClose: () => void;
  onSave: () => void;
}) => {
  const [medicalFormData, setMedicalFormData] = useState({
    pregnancyStatus: room.medicalData?.pregnancyStatus || "",
    bloodType: room.medicalData?.bloodType || "",
    conditions: room.medicalData?.conditions || {},
    medications: room.medicalData?.medications || {},
    allergies: room.medicalData?.allergies || {},
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (room.medicalData) {
        await handleUpdateMedicalRecord(room.id, medicalFormData);
      } else {
        await handleAddMedicalRecord(room.id);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving medical record:", error);
      toast.error("Failed to save medical record");
    }
  };

  const handleAddMedicalRecord = async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/medical?businessId=${BUSINESS_CONFIG.businessId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pregnancyStatus: medicalFormData.pregnancyStatus,
          bloodType: medicalFormData.bloodType,
          conditions: medicalFormData.conditions,
          medications: medicalFormData.medications,
          allergies: medicalFormData.allergies,
          highRisk: false, // Default value
          gestationalAge: null,
          dueDate: null,
          vitalSigns: null,
          fhirPatientId: null,
          fhirReferences: null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add medical record");
      }

      toast.success("Medical record created successfully");
    } catch (error) {
      toast.error(error.message || "Failed to create medical record");
      console.error("Error adding medical record:", error);
    }
  };

  const handleUpdateMedicalRecord = async (roomId: string, data: any) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/medical?businessId=${BUSINESS_CONFIG.businessId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pregnancyStatus: data.pregnancyStatus,
          bloodType: data.bloodType,
          conditions: data.conditions,
          medications: data.medications,
          allergies: data.allergies,
          highRisk: false, // Default value
          gestationalAge: null,
          dueDate: null,
          vitalSigns: null,
          fhirPatientId: null,
          fhirReferences: null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update medical record");
      }

      toast.success("Medical record updated successfully");
    } catch (error) {
      toast.error(error.message || "Failed to update medical record");
      console.error("Error updating medical record:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col h-[90vh] max-h-[90vh]">
        <div className="border-b p-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">
            {room.medicalData ? "Edit" : "Add"} Medical Record
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
          <div className="overflow-y-auto flex-grow p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pregnancy Status
              </label>
              <Input
                type="text"
                value={medicalFormData.pregnancyStatus}
                onChange={(e) =>
                  setMedicalFormData((prev) => ({
                    ...prev,
                    pregnancyStatus: e.target.value,
                  }))
                }
                placeholder="e.g., Not Pregnant, Pregnant"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blood Type
              </label>
              <Input
                type="text"
                value={medicalFormData.bloodType}
                onChange={(e) =>
                  setMedicalFormData((prev) => ({
                    ...prev,
                    bloodType: e.target.value,
                  }))
                }
                placeholder="e.g., A+, B-, AB+, O-"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Conditions
              </label>
              <div className="space-y-2">
                {Object.keys(medicalFormData.conditions).map((key) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Input
                      type="text"
                      value={medicalFormData.conditions[key]}
                      onChange={(e) =>
                        setMedicalFormData((prev) => ({
                          ...prev,
                          conditions: {
                            ...prev.conditions,
                            [key]: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Diabetes, Asthma"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMedicalFormData((prev) => ({
                          ...prev,
                          conditions: Object.fromEntries(
                            Object.entries(prev.conditions).filter(
                              ([k]) => k !== key
                            )
                          ),
                        }))
                      }
                      className="text-red-500 hover:text-red-700"
                      aria-label="Remove condition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setMedicalFormData((prev) => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        [Date.now().toString()]: "",
                      },
                    }))
                  }
                  className="text-blue-500 hover:text-blue-700 flex items-center space-x-1 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Condition</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medications
              </label>
              <div className="space-y-2">
                {Object.keys(medicalFormData.medications).map((key) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Input
                      type="text"
                      value={medicalFormData.medications[key]}
                      onChange={(e) =>
                        setMedicalFormData((prev) => ({
                          ...prev,
                          medications: {
                            ...prev.medications,
                            [key]: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Metformin, Albuterol"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMedicalFormData((prev) => ({
                          ...prev,
                          medications: Object.fromEntries(
                            Object.entries(prev.medications).filter(
                              ([k]) => k !== key
                            )
                          ),
                        }))
                      }
                      className="text-red-500 hover:text-red-700"
                      aria-label="Remove medication"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setMedicalFormData((prev) => ({
                      ...prev,
                      medications: {
                        ...prev.medications,
                        [Date.now().toString()]: "",
                      },
                    }))
                  }
                  className="text-blue-500 hover:text-blue-700 flex items-center space-x-1 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Medication</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allergies
              </label>
              <div className="space-y-2">
                {Object.keys(medicalFormData.allergies).map((key) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Input
                      type="text"
                      value={medicalFormData.allergies[key]}
                      onChange={(e) =>
                        setMedicalFormData((prev) => ({
                          ...prev,
                          allergies: {
                            ...prev.allergies,
                            [key]: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Penicillin, Peanuts"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMedicalFormData((prev) => ({
                          ...prev,
                          allergies: Object.fromEntries(
                            Object.entries(prev.allergies).filter(
                              ([k]) => k !== key
                            )
                          ),
                        }))
                      }
                      className="text-red-500 hover:text-red-700"
                      aria-label="Remove allergy"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setMedicalFormData((prev) => ({
                      ...prev,
                      allergies: {
                        ...prev.allergies,
                        [Date.now().toString()]: "",
                      },
                    }))
                  }
                  className="text-blue-500 hover:text-blue-700 flex items-center space-x-1 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Allergy</span>
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medical Images
            </label>
            <MedicalImageUpload
              roomId={room.id}
              onUploadComplete={(results) => {
                toast.success(`${results.length} image(s) uploaded and analyzed`);
                // Optionally refresh the medical data
                onSave();
              }}
              onError={(error) => {
                toast.error(`Upload failed: ${error.message}`);
              }}
            />
          </div>
          <div className="p-4 border-t flex justify-end space-x-2 shrink-0">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {room.medicalData ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MedicalForm;