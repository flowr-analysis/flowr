library(shiny)

ui <- fluidPage(
  titlePanel("Fuel use by weight"),
  sliderInput("cyl", "Cylinders", min = 4, max = 8, value = c(4, 8), step = 2),
  plotOutput("scatter"),
  tableOutput("summary")
)

server <- function(input, output) {
  chosen <- reactive(subset(mtcars, cyl >= input$cyl[1] & cyl <= input$cyl[2]))
  output$scatter <- renderPlot(
    plot(mpg ~ wt, data = chosen(), pch = 19, col = factor(chosen()$cyl),
      xlab = "weight (1000 lbs)", ylab = "miles per gallon"))
  output$summary <- renderTable(aggregate(mpg ~ cyl, data = chosen(), FUN = mean))
}

shinyApp(ui, server)
