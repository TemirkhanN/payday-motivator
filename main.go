package main

import (
	"fmt"
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
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
	a := app.New()
	w := a.NewWindow("Payday motivator")
	w.Resize(fyne.NewSize(300, 100))

	incomeInput := widget.NewEntry()
	incomeInput.SetText("25000")
	incomeInput.SetPlaceHolder(incomeInput.Text)

	workingHoursInput := widget.NewEntry()
	workingHoursInput.SetText("08:00-17:00")
	workingHoursInput.SetPlaceHolder(workingHoursInput.Text)

	configForm := widget.NewForm(
		widget.NewFormItem("Yearly salary", incomeInput),
		widget.NewFormItem("Working hours", workingHoursInput),
	)

	configForm.OnSubmit = func() {
		yearlySalary := forceToInt(incomeInput.Text)
		wh := parseWorkingHours(workingHoursInput.Text)

		if wh != emptyWorkingHours && yearlySalary != 0 {
			salary := calculateIncome(yearlySalary, wh)

			startMotivation(salary, wh, func(todayEarned float32) {
				incomeValue := widget.NewRichTextWithText(fmt.Sprintf("%.2f € Earned Today", todayEarned))
				w.SetContent(container.NewVBox(incomeValue))
			})
		}
	}

	w.SetContent(configForm)
	w.Show()
	a.Run()
}

func startMotivation(income salary, hours workingHours, motivator func(earnedToday float32)) {
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
					// Working day has ended
					if currentHour >= hours.to.hours {
						totalSecondsWorked = int(hours.totalWorkingHours() * 60 * 60)
					} else {
						// Working day has not yet started or is in progress
						totalSecondsWorked = 60*((60*(currentHour-hours.from.hours))+currentMinute-hours.from.minutes) + currentSecond
					}

					todayEarned = float32(totalSecondsWorked) * income.secondly
				}
				motivator(todayEarned)
			case <-quit:
				ticker.Stop()

				return
			}
		}
	}()
}

func parseWorkingHours(rawWorkingHours string) workingHours {
	pattern := regexp.MustCompile("^([0-2][0-9]):([0-5][0-9])-([0-2][0-9]):([0-5][0-9])$")

	vals := pattern.FindStringSubmatch(rawWorkingHours)
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
