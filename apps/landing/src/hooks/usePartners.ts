import { useState } from "react";
import { submitContactForm } from "@resomix/api-client";

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

  const handleFormSubmit = async (e: React.FormEvent) => {
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
      // Submit to the backend contact endpoint (saved as a `partner` contact; the submitter also
      // gets an acknowledgement email). No more opening the user's mail client.
      const result: any = await submitContactForm({
        contact_type: "partner",
        name: formData.contactName.trim(),
        email: formData.contactEmail.trim(),
        message: formData.message.trim() || undefined,
        company_name: formData.companyName.trim(),
        catalog_size: formData.estimatedTracks.trim() || undefined,
        estimated_calls: formData.estimatedCalls.trim() || undefined,
      });

      if (result?.success) {
        setIsSuccess(true);
        setFormData(initialFormState);
      } else {
        setErrorMessage(
          result?.error ||
            "Could not submit your request. Please try again, or email partners@resomix.com."
        );
      }
    } catch (err: any) {
      setErrorMessage(
        "Could not submit your request. Please try again, or email partners@resomix.com."
      );
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
