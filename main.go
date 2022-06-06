package main

import (
	"fmt"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/martinlindhe/inputbox"
	"regexp"
	"strconv"
	"time"
)

type timeEntry struct {
	hours   int
	minutes int
}

type workingHours struct {
	from timeEntry
	to   timeEntry
}

func (wh workingHours) totalWorkingHours() float32 {
	hours := float32(wh.to.hours - wh.from.hours)
	minutes := float32(wh.to.minutes - wh.from.minutes)

	return hours + (minutes / 60)
}

type salary struct {
	yearly   int
	monthly  float32
	daily    float32
	hourly   float32
	secondly float32
}

func calculateIncome(yearlySalary int, hours workingHours) salary {
	monthlyIncome := float32(yearlySalary) / 12
	dailyIncome := monthlyIncome / float32(averageWorkingDaysPerMonth)
	hourlyIncome := dailyIncome / hours.totalWorkingHours()
	secondly := hourlyIncome / 60 / 60

	return salary{
		yearly:   yearlySalary,
		monthly:  monthlyIncome,
		daily:    dailyIncome,
		hourly:   hourlyIncome,
		secondly: secondly,
	}
}

var (
	emptyWorkingHours          = workingHours{}
	averageWorkingDaysPerMonth = 22
)

func main() {
	yearlySalary := 0
	workingHours := emptyWorkingHours

	for yearlySalary == 0 {
		yearlySalary = inputSalary()
	}

	for workingHours == emptyWorkingHours {
		workingHours = inputWorkingHours()
	}

	startMotivation(yearlySalary, workingHours)
}

func startMotivation(yearlySalary int, hours workingHours) {
	salary := calculateIncome(yearlySalary, hours)

	a := app.New()
	w := a.NewWindow("Today income")

	incomeLabel := widget.NewLabel("Today's income:")
	w.SetContent(container.NewVBox(incomeLabel))

	ticker := time.NewTicker(time.Second)
	quit := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				now := time.Now()
				currentHour := now.Hour()
				currentMinute := now.Minute()
				currentSecond := now.Second()
				var todayEarned float32
				if currentHour >= hours.from.hours {
					totalSecondsWorked := 0
					if currentHour >= hours.to.hours {
						totalSecondsWorked = int(hours.totalWorkingHours() * 60 * 60)
					} else {
						totalSecondsWorked = 60*((60*(currentHour-hours.from.hours))+currentMinute-hours.from.minutes) + currentSecond
					}

					todayEarned = float32(totalSecondsWorked) * salary.secondly
				}
				incomeValue := widget.NewRichTextWithText(fmt.Sprintf("%.1f € Earned Today", todayEarned))
				w.SetContent(container.NewVBox(incomeValue))
			case <-quit:
				ticker.Stop()

				return
			}
		}
	}()

	w.ShowAndRun()
}

func inputSalary() int {
	yearlySalary, ok := inputbox.InputBox("Configure income", "Yearly salary", "0")

	if !ok {
		return 0
	}

	return forceToInt(yearlySalary)
}

func inputWorkingHours() workingHours {
	value, ok := inputbox.InputBox("Configure working hours", "Set interval", "08:00-17:00")
	if !ok {
		return emptyWorkingHours
	}

	pattern := regexp.MustCompile("^([0-2][0-9]):([0-5][0-9])-([0-2][0-9]):([0-5][0-9])$")

	vals := pattern.FindStringSubmatch(value)
	if vals == nil {
		return emptyWorkingHours
	}

	return workingHours{
		from: timeEntry{
			hours:   forceToInt(vals[1]),
			minutes: forceToInt(vals[2]),
		},
		to: timeEntry{
			hours:   forceToInt(vals[3]),
			minutes: forceToInt(vals[4]),
		},
	}
}

func forceToInt(value string) int {
	converted, err := strconv.Atoi(value)

	if err != nil {
		return 0
	}

	return converted
}
