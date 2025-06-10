"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar, CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"

interface DateRangeSelectorProps {
  startDate?: Date
  endDate?: Date
  onStartDateChange: (date: Date | undefined) => void
  onEndDateChange: (date: Date | undefined) => void
}

export function DateRangeSelector({ startDate, endDate, onStartDateChange, onEndDateChange }: DateRangeSelectorProps) {
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  const handleStartDateSelect = (date: Date | undefined) => {
    onStartDateChange(date)
    setStartDateOpen(false)
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    onEndDateChange(date)
    setEndDateOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Date Range</h3>
          <p className="text-sm text-gray-600">Select the time period to analyze for changes</p>
        </div>
      </div>

      {/* Date Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-12 justify-start text-left font-normal bg-white border-gray-200 hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <CalendarDays className="mr-3 h-4 w-4 text-gray-400" />
                {startDate ? (
                  <span className="text-gray-900">{format(startDate, "MMMM dd, yyyy")}</span>
                ) : (
                  <span className="text-gray-500">Select start date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white border border-gray-200 shadow-xl" align="start">
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                initialFocus
                className="rounded-lg"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-12 justify-start text-left font-normal bg-white border-gray-200 hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <CalendarDays className="mr-3 h-4 w-4 text-gray-400" />
                {endDate ? (
                  <span className="text-gray-900">{format(endDate, "MMMM dd, yyyy")}</span>
                ) : (
                  <span className="text-gray-500">Select end date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white border border-gray-200 shadow-xl" align="start">
              <CalendarComponent
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                initialFocus
                className="rounded-lg"
                disabled={(date) => (startDate ? date < startDate : false)}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Selected Range Display */}
      {startDate && endDate && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Selected range:</span>
            <span className="font-medium text-gray-900">
              {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
