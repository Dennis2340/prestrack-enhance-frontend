import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateAgentId } from "@/lib/utils";
import { BUSINESS_CONFIG } from "../../config";

interface AddAgentFormProps {
  onClose: () => void;
  onAgentAdded: () => void;
}

const AddAgentForm: React.FC<AddAgentFormProps> = ({
  onClose,
  onAgentAdded,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agentId] = useState(generateAgentId()); // Initialize directly
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/agent/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          agentId,
          businessId: BUSINESS_CONFIG.businessId,
        }),
      });

      if (response.ok) {
        onAgentAdded();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create agent.");
      }
    } catch (err) {
      console.error("Error creating agent:", err);
      setError("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (agentId) {
      navigator.clipboard.writeText(agentId);
      alert("Agent ID copied to clipboard!");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-md">
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="mb-4">
        <label className="block text-gray-700 mb-2" htmlFor="name">
          Name
        </label>
        <Input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2" htmlFor="email">
          Email
        </label>
        <Input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2" htmlFor="agentId">
          Agent ID
        </label>
        <div className="flex items-center">
          <Input
            type="text"
            id="agentId"
            value={agentId || ""}
            readOnly
            className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <Button
            onClick={copyToClipboard}
            className="ml-2 bg-gray-600 text-white hover:bg-gray-500"
          >
            Copy
          </Button>
        </div>
      </div>
      <Button
        type="submit"
        className={`bg-${BUSINESS_CONFIG.theme.primaryColor} text-white hover:bg-${BUSINESS_CONFIG.theme.hoverColor}`}
        disabled={loading}
      >
        {loading ? "Creating..." : `Add ${BUSINESS_CONFIG.name} Agent`}
      </Button>
    </form>
  );
};

export default AddAgentForm;
