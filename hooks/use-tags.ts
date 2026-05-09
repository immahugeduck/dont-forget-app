"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface UserTag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface ChecklistTag {
  id: string
  checklist_id: string
  tag_id: string
  created_at: string
}

// Extract #tags from text
export function extractTags(text: string): string[] {
  const tagRegex = /#(\w+)/g
  const matches = text.match(tagRegex)
  if (!matches) return []
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))]
}

// Remove #tags from text for display
export function stripTags(text: string): string {
  return text.replace(/#\w+/g, "").trim().replace(/\s+/g, " ")
}

export function useTags() {
  const [tags, setTags] = useState<UserTag[]>([])
  const [checklistTags, setChecklistTags] = useState<Record<string, UserTag[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Load all user tags
  const loadTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tags")
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags || [])
      }
    } catch (error) {
      console.error("Error loading tags:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load tags for specific checklist items
  const loadChecklistTags = useCallback(
    async (checklistIds: string[]) => {
      if (checklistIds.length === 0) return

      try {
        const { data, error } = await supabase
          .from("checklist_tags")
          .select(`
            checklist_id,
            tag:user_tags(*)
          `)
          .in("checklist_id", checklistIds)

        if (error) throw error

        const tagMap: Record<string, UserTag[]> = {}
        data?.forEach((row: { checklist_id: string; tag: UserTag }) => {
          if (!tagMap[row.checklist_id]) {
            tagMap[row.checklist_id] = []
          }
          if (row.tag) {
            tagMap[row.checklist_id].push(row.tag)
          }
        })
        setChecklistTags((prev) => ({ ...prev, ...tagMap }))
      } catch (error) {
        console.error("Error loading checklist tags:", error)
      }
    },
    [supabase]
  )

  // Create or get a tag by name
  const getOrCreateTag = useCallback(
    async (name: string): Promise<UserTag | null> => {
      const normalizedName = name.toLowerCase().trim().replace(/^#/, "")
      
      // Check if we already have this tag locally
      const existing = tags.find((t) => t.name === normalizedName)
      if (existing) return existing

      try {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: normalizedName }),
        })

        if (response.ok) {
          const data = await response.json()
          const tag = data.tag
          
          // Add to local state if new
          setTags((prev) => {
            if (prev.find((t) => t.id === tag.id)) return prev
            return [...prev, tag]
          })
          
          return tag
        }
      } catch (error) {
        console.error("Error creating tag:", error)
      }
      return null
    },
    [tags]
  )

  // Assign tags to a checklist item (from extracted #tags in text)
  const assignTagsToChecklist = useCallback(
    async (checklistId: string, tagNames: string[]) => {
      const assignedTags: UserTag[] = []

      for (const name of tagNames) {
        const tag = await getOrCreateTag(name)
        if (tag) {
          // Check if already assigned
          const existingTags = checklistTags[checklistId] || []
          if (!existingTags.find((t) => t.id === tag.id)) {
            // Insert into checklist_tags
            const { error } = await supabase.from("checklist_tags").insert({
              checklist_id: checklistId,
              tag_id: tag.id,
            })

            if (!error) {
              assignedTags.push(tag)
            }
          }
        }
      }

      // Update local state
      if (assignedTags.length > 0) {
        setChecklistTags((prev) => ({
          ...prev,
          [checklistId]: [...(prev[checklistId] || []), ...assignedTags],
        }))
      }
    },
    [getOrCreateTag, checklistTags, supabase]
  )

  // Remove a tag from a checklist item
  const removeTagFromChecklist = useCallback(
    async (checklistId: string, tagId: string) => {
      try {
        const { error } = await supabase
          .from("checklist_tags")
          .delete()
          .eq("checklist_id", checklistId)
          .eq("tag_id", tagId)

        if (!error) {
          setChecklistTags((prev) => ({
            ...prev,
            [checklistId]: (prev[checklistId] || []).filter((t) => t.id !== tagId),
          }))
        }
      } catch (error) {
        console.error("Error removing tag from checklist:", error)
      }
    },
    [supabase]
  )

  // Update a tag's properties
  const updateTag = useCallback(
    async (id: string, updates: { name?: string; color?: string }) => {
      try {
        const response = await fetch("/api/tags", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        })

        if (response.ok) {
          const data = await response.json()
          setTags((prev) => prev.map((t) => (t.id === id ? data.tag : t)))
          return data.tag
        }
      } catch (error) {
        console.error("Error updating tag:", error)
      }
      return null
    },
    []
  )

  // Delete a tag
  const deleteTag = useCallback(async (id: string) => {
    try {
      const response = await fetch("/api/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (response.ok) {
        setTags((prev) => prev.filter((t) => t.id !== id))
        // Also remove from checklist tags
        setChecklistTags((prev) => {
          const updated = { ...prev }
          for (const checklistId in updated) {
            updated[checklistId] = updated[checklistId].filter((t) => t.id !== id)
          }
          return updated
        })
      }
    } catch (error) {
      console.error("Error deleting tag:", error)
    }
  }, [])

  // Search checklists by tag
  const searchByTag = useCallback(
    async (tagName: string): Promise<string[]> => {
      const normalizedName = tagName.toLowerCase().trim().replace(/^#/, "")
      const tag = tags.find((t) => t.name === normalizedName)
      
      if (!tag) return []

      try {
        const { data, error } = await supabase
          .from("checklist_tags")
          .select("checklist_id")
          .eq("tag_id", tag.id)

        if (error) throw error
        return data?.map((row) => row.checklist_id) || []
      } catch (error) {
        console.error("Error searching by tag:", error)
        return []
      }
    },
    [tags, supabase]
  )

  useEffect(() => {
    loadTags()
  }, [loadTags])

  return {
    tags,
    checklistTags,
    isLoading,
    loadTags,
    loadChecklistTags,
    getOrCreateTag,
    assignTagsToChecklist,
    removeTagFromChecklist,
    updateTag,
    deleteTag,
    searchByTag,
  }
}
