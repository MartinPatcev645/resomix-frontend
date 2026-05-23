import { useState } from "react";

export interface B2BFormState {
  companyName: string;
  contactName: string;
  contactEmail: string;
  message: string;
  estimatedTracks: string;
  estimatedCalls: string;
}

const initialFormState: B2BFormState = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  message: "",
  estimatedTracks: "",
  estimatedCalls: "",
};

export function usePartners() {
  const [formData, setFormData] = useState<B2BFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCopyCredentials = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    // Validation
    if (!formData.companyName.trim()) {
      setErrorMessage("Company / Legal name is required.");
      setIsSubmitting(false);
      return;
    }
    if (!formData.contactName.trim()) {
      setErrorMessage("Contact name is required.");
      setIsSubmitting(false);
      return;
    }
    if (!formData.contactEmail.trim() || !formData.contactEmail.includes("@")) {
      setErrorMessage("A valid contact email is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Compose Mailto url
      const subject = encodeURIComponent(`B2B Resomix Partner Request: ${formData.companyName}`);
      const body = encodeURIComponent(
        `Dear Resomix Team,

I would like to request a B2B Production API Key for Resomix.

Here are our details:
---------------------------------------------
Legal/Company Name: ${formData.companyName}
Contact Name: ${formData.contactName}
Contact Email: ${formData.contactEmail}
Estimated Catalog Size (Tracks): ${formData.estimatedTracks || "Not specified"}
Estimated Monthly API Calls: ${formData.estimatedCalls || "Not specified"}

Use Case / Message:
${formData.message || "Not specified"}

---------------------------------------------
Thank you,
${formData.contactName}
`
      );

      const mailtoUrl = `mailto:partners@resomix.com?subject=${subject}&body=${body}`;
      
      // Open the user's default email client
      window.location.href = mailtoUrl;

      setIsSuccess(true);
      setFormData(initialFormState);
    } catch (err: any) {
      setErrorMessage("Could not open mail client. Please send details to partners@resomix.com");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    isSubmitting,
    isSuccess,
    errorMessage,
    copySuccess,
    setIsSuccess,
    handleInputChange,
    handleFormSubmit,
    handleCopyCredentials,
  };
}
