import { useState, useCallback } from "react";
import type { ValidationResult } from "./validators";

/**
 * Field validator function type
 */
export type FieldValidator = (value: any) => ValidationResult;

/**
 * Validation schema type
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: FieldValidator | FieldValidator[];
};

/**
 * Validation errors type
 */
export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

/**
 * Form validation hook
 * Provides field-level and form-level validation with error tracking
 */
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationSchema: ValidationSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    (fieldName: keyof T, value: any): string | undefined => {
      const validators = validationSchema[fieldName];
      if (!validators) return undefined;

      const validatorArray = Array.isArray(validators) ? validators : [validators];

      for (const validator of validatorArray) {
        const result = validator(value);
        if (!result.isValid) {
          return result.error;
        }
      }

      return undefined;
    },
    [validationSchema]
  );

  /**
   * Validate all fields
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors<T> = {};
    let isValid = true;

    for (const fieldName in validationSchema) {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [values, validationSchema, validateField]);

  /**
   * Set value for a field and validate it
   */
  const setValue = useCallback(
    (fieldName: keyof T, value: any) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }));

      // Validate field if it has been touched
      if (touched[fieldName]) {
        const error = validateField(fieldName, value);
        setErrors((prev) => ({
          ...prev,
          [fieldName]: error,
        }));
      }
    },
    [touched, validateField]
  );

  /**
   * Set multiple values at once
   */
  const setFormValues = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  /**
   * Mark a field as touched and validate it
   */
  const setFieldTouched = useCallback(
    (fieldName: keyof T) => {
      setTouched((prev) => ({ ...prev, [fieldName]: true }));
      const error = validateField(fieldName, values[fieldName]);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    },
    [values, validateField]
  );

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Clear a specific field error
   */
  const clearFieldError = useCallback((fieldName: keyof T) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Reset form to initial values
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({} as Record<keyof T, boolean>);
  }, [initialValues]);

  /**
   * Check if form has any errors
   */
  const hasErrors = Object.keys(errors).length > 0;

  /**
   * Get error for a specific field
   */
  const getFieldError = useCallback(
    (fieldName: keyof T): string | undefined => {
      return errors[fieldName];
    },
    [errors]
  );

  /**
   * Check if a field has been touched
   */
  const isFieldTouched = useCallback(
    (fieldName: keyof T): boolean => {
      return touched[fieldName] || false;
    },
    [touched]
  );

  return {
    values,
    errors,
    touched,
    setValue,
    setFormValues,
    setFieldTouched,
    validateField,
    validateForm,
    clearErrors,
    clearFieldError,
    resetForm,
    hasErrors,
    getFieldError,
    isFieldTouched,
  };
}

