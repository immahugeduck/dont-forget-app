"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface UserCategory {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  position: number
  created_at: string
}

// Default category for new users
const DEFAULT_CATEGORY: Omit<UserCategory, "id" | "user_id" | "created_at"> = {
  name: "Personal",
  color: "#8b5cf6",
  icon: "user",
  position: 0,
}

export function useCategories() {
  const [categories, setCategories] = useState<UserCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Load categories
  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/categories")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load categories")
      }

      // If user has no categories, create the default one
      if (data.categories.length === 0) {
        const createResponse = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT_CATEGORY),
        })
        
        if (createResponse.ok) {
          const { category } = await createResponse.json()
          setCategories([category])
        }
      } else {
        setCategories(data.categories)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Add a new category
  const addCategory = useCallback(async (name: string, color?: string, icon?: string) => {
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, icon }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add category")
      }

      setCategories((prev) => [...prev, data.category])
      return data.category
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      return null
    }
  }, [])

  // Update a category
  const updateCategory = useCallback(async (
    id: string, 
    updates: Partial<Pick<UserCategory, "name" | "color" | "icon" | "position">>
  ) => {
    try {
      const response = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update category")
      }

      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? data.category : cat))
      )
      return data.category
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      return null
    }
  }, [])

  // Delete a category
  const deleteCategory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete category")
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      return false
    }
  }, [])

  // Load categories on auth state change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        loadCategories()
      } else if (event === "SIGNED_OUT") {
        setCategories([])
      }
    })

    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadCategories()
      } else {
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, loadCategories])

  return {
    categories,
    isLoading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    reload: loadCategories,
  }
}
