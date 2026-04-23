import type { AnalyzerSetupFunction } from '../../lazy-evaluation/lazy-function-eval.test';

export const RealScriptWithError: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: `
        ### Replication material for
### Nash Optimal Party Positions: The nopp  R Package

###################################################
## An application: The 2006 Italian general election
###################################################

## First step: The empirical choice model
library("nopp")
data("italy2006", package = "nopp")
head(italy2006)
colnames(italy2006)
election <- set.data(italy2006, shape = "wide", choice = "vote", 
  varying = 5:14, sep = "_")
head(election)

m <- mlogit(vote ~ prox + partyID | gov_perf + sex + age + education, 
  election, reflevel = "FI")
summary(m)

m2 <- mlogit(vote ~ partyID | gov_perf + sex + age + education | prox,
  election, reflevel = "FI")
summary(m2)

m3 <- mlogit(vote ~ prox + partyID  | gov_perf + sex +
  age + education, italy2006, shape = "wide", choice = "vote",
  varying = 5:14, sep = "_", reflevel = "FI")

## Second step: Estimating party optimal positions
nash.eq <- equilibrium(model = m, data = election)
nash.eq

external.pos <- list(FI = 7.76, UL = 3.54, RC = 1.91,
  AN = 8.27, UDC = 5.99)
external.votes <- list(FI = 0.25, UL = 0.38, RC = 0.10,
  AN = 0.18, UDC = 0.07)
nash.eq <- equilibrium(model = m, data = election, 
  pos = external.pos, votes = external.votes)
nash.eq


coal1 <- list(FI = 1, UL = 2, RC = 2, AN = 1, UDC = 1)
alpha1 <- list(FI = 0.7, UL = 0.8, RC = 0.1, AN = 0.5, UDC = 0.5)
nash.eq <- equilibrium(model = m, data = election, 
  coal = coal1, alpha = alpha1)
nash.eq

nash.eq <- equilibrium(model = m, data = election,
  pos = c(FI = 7.76, UL = 3.54, RC = 1.91, AN = 8.27, UDC = 5.99),
  votes = c(FI = 0.25, UL = 0.38, RC = 0.10, AN = 0.18, UDC = 0.07),
  coal = coal1, alpha = alpha1)
nash.eq

nash.eq <- equilibrium(model = m, data = election, 
  margin = list(UL = "FI"))
nash.eq

nash.eq <- equilibrium(model = m, data = election, 
  margin = list(FI = "UL", UL = "FI"))
nash.eq

nash.eq <- equilibrium(model = m, data = election,
  fixed = list(RC = 1.95), gamma = 0.5)
nash.eq

nash.eq <- equilibrium(model = m, data = election, 
  margin = list(FI = "UL", UL = "FI"),
  fixed = list(RC = 1), gamma = 0.2)

coal1 <- list(FI = 1, UL = 2, RC = 2, AN = 1, UDC = 1)
alpha1 <- list(FI = 0.7, UL = 0.8, RC = 0.5, AN = 0.5, UDC = 0.5)
nash.eq <- equilibrium(model = m, data = election, coal = coal1, 
  alpha = alpha1, fixed = list(RC = 1), gamma = 0.6)

## Linear utility function
data("italy2006.lin", package = "nopp")
election3 <- set.data(italy2006.lin, shape = "wide", 
  choice = "vote", varying = c(5:14), sep = "_")
m3 <- mlogit(vote ~ proxlin + partyID | gov_perf + sex +
  age + education, election3, reflevel = "FI")
nash.eq3 <- equilibrium(model = m3, data = election3,
  quadratic = FALSE)
nash.eq3

## Estimating uncertainty
set.seed(123)
nash.eq.boot <- equilibrium(model = m, data = election, boot = 100)  
nash.eq.boot


set.seed(123)
nash.eq.mc <- equilibrium(model = m, data = election, MC = 100) 
nash.eq.mc

###################################################
## Graphical display of the results
###################################################
nash.eq <- equilibrium(model = m, data = election)
plot(nash.eq)

external.pos <- list(FI = 7.76, UL = 3.54, RC = 1.91, 
  AN = 8.27, UDC = 5.99)
external.votes <- list(FI = 0.25, UL = 0.38, RC = 0.10, 
  AN = 0.18, UDC = 0.07)

nash.eq <- equilibrium(model = m, data = election, 
  pos = external.pos, votes = external.votes)
plot(nash.eq)
plot(nash.eq.boot)

###################################################
### Appendix: Preparing the data
###################################################
data("italy2006.wide", package = "nopp")
head(italy2006.wide)

varlist <- c("FI", "DS", "AN", "DL", "UDC", "RC")
for (var in varlist) {
  assign(sprintf("mean_%s", var),
         mean(italy2006.wide[, var], na.rm = TRUE))
}

mean_UL <- (mean_DS + mean_DL) / 2
mean_UL

varlist <- c("FI", "UL", "AN", "UDC", "RC")
for (var in varlist) {
  italy2006.wide[[sprintf("prox_%s", var)]] <-
    -(get(sprintf("mean_%s", var)) - italy2006.wide$self)^2
}

for (var in varlist) {
  italy2006.wide[[sprintf("proxlin_%s", var)]] <-
    -abs(get(sprintf("mean_%s", var)) - italy2006.wide$self)
}
head(italy2006.wide)

italy2006.wide$UL <- (italy2006.wide$DS + italy2006.wide$DL) / 2
varlist <- c("FI", "UL", "AN", "UDC", "RC")
for (var in varlist) {
  italy2006.wide[[sprintf("proxego_%s", var)]] <- 
    -(italy2006.wide[[var]] - italy2006.wide$self)^2
}

italy2006.wide$partyID_FI <- as.numeric(italy2006.wide$pID == 1)
italy2006.wide$partyID_UL <- as.numeric(italy2006.wide$pID == 23)
italy2006.wide$partyID_AN <- as.numeric(italy2006.wide$pID == 3)
italy2006.wide$partyID_UDC <- as.numeric(italy2006.wide$pID == 4)
italy2006.wide$partyID_RC <- as.numeric(italy2006.wide$pID == 6)

colnames(italy2006.wide)
election <- set.data(italy2006.wide, shape = "wide", 
  choice = "vote", varying = c(16:25, 27:36), sep = "_")
head(election)

m <- mlogit(vote ~ prox + partyID  | gov_perf + sex, 
  election, reflevel = "UL")
election2 <- election
idx <- which( is.na(election2$gov_perf) | 
  is.na(election2$prox) | is.na(election2$partyID) )
election2 <- election2[-idx, ]
nash.eq <- equilibrium(model = m, data = election2)
nash.eq

        ` });
	return analyzer;
};

export const SingleFileFailures: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: `## YGfeature Marine GIS DATABASE in Hong Kong
## Author: Vincent Yifei Gu
## Starting date: 2019-04-28
## Online data: 2019-05-27
## Version no: 2.3
### update log 1: use dashboardPage() layout
### update log 2: enhanced the connectivity between Species Explorer and Data Management
### update log 3: some basic annotation added

library(shiny)
library(shinydashboard)
library(shinyjs)
library(glue)
library(shinyauthr) # install this pkg by devtools::install_github("paulc91/shinyauthr")
library(data.table)
library(dplyr)
library(DT)
library(leaflet)
library(leaflet.extras)
library(mapview)
library(webshot)
library(shinyalert)
library(sodium)
library(shinythemes)
#library(shinycssloaders)



### Here is the global section for this app ###

## load your own dataset here
## the '.rds' data format is recommended for R
## this data is used for 'Habitat Map'
df <- readRDS("zall.rds")

phantomjs_path <- webshot:::find_phantom()
if (is.null(phantomjs_path)){
  webshot::install_phantomjs()
} else {
  print(paste('phantomjs is installed -', phantomjs_path))
}

# sample user base for storing user credentials
user_base <- data.frame(
  user = c("Editor", "Admin", "Guest"),
  password = c("pass_editor", "pass_admin", "pass_guest"),
  password_hash = sapply(c("pass_editor", "pass_admin", "pass_guest"), sodium::password_store),
  permissions = c("admin", "admin", "standard"),
  name = c("Editor", "Admin", "Guest")
)

# color code for habitat legend
pal <- colorFactor(palette = c("#d73027", "#fc8d59", "#fee090", "#ffffbf", "#e0f3f8", "#91bfdb", "#4575b4"),
                   levels = c("Coastal water", "Demersal", "Hard substrata", "Mangrove",
                              "Rocky shore", "Seagrass bed", "Soft shore"))

# Note its possible to asign title = titlemodify, but not necessary
#titlemodify <- tags$p(tags$a(href = 'https://www.swims.hku.hk/',
#                tags$img(src = "hku.png", height = '40', width = '35')),
#                "SWIMS DATABASE")

header <- dashboardHeader(title = "SWIMS DATABASE",
                          #titleWidth = 300,
                        tags$li(class = "dropdown", style = "padding: 8px;",
                                shinyauthr::logoutUI("logout")))

sidebar <- dashboardSidebar(collapsed = TRUE,
                            div(textOutput("welcome"), style = "padding: 20px"))

body <- dashboardBody(
  shinyjs::useShinyjs(),
  tags$head(tags$style(".table{margin: 0 auto;}"),
            tags$script(src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/3.5.16/iframeResizer.contentWindow.min.js",
                        type="text/javascript"),
            includeScript("returnClick.js")
  ),
  shinyauthr::loginUI("login"),
  uiOutput("prelogin"),
  uiOutput("afterlogin"),
  HTML('<div data-iframe-height></div>')
)



### Here is the user interface framework for this app ###

ui <- dashboardPage(header, sidebar, body,
                    skin = "blue", # by defalut is 'blue', but other color is possible
                    useShinyalert())



### Here is the backend section for this app ###

server <- function(input, output, session) {

  credentials <- callModule(shinyauthr::login, "login",
                            data = user_base,
                            user_col = user,
                            pwd_col = password_hash,
                            sodium_hashed = TRUE,
                            log_out = reactive(logout_init()))

  logout_init <- callModule(shinyauthr::logout, "logout",
                            reactive(credentials()$user_auth))

  user_info <- reactive({credentials()$info})

  output$prelogin <- renderUI({
    if(credentials()$user_auth) return(NULL)

    tagList(
      tags$p(
        #h5(align = 'center', "Please login this database with your credentials."),
             #br(), br(),
             h3(align = 'center', "For guest user, your User Name is 'Guest', your Password is 'SWIMS'."),
             br(),
             h4(align = 'center', "Please refresh the webpage everytime before you re-login.")
      ),
      br(),
      tags$a(href = 'https://www.swims.hku.hk/',
      tags$img(align = 'right', src = "SWIMS logo.png", height = '120', width = '116.5'))
    )
  })

  observe({
    if(credentials()$user_auth) {
      shinyjs::removeClass(selector = "body", class = "sidebar-collapse")
    } else {
      shinyjs::addClass(selector = "body", class = "sidebar-collapse")
    }
  })

  output$welcome <- reactive({
    req(credentials()$user_auth)
    glue("Welcome {user_info()$name}, today is {Sys.Date()}.")
  })

  output$afterlogin <- renderUI({
    afterloginUI()
  })

  df1 <- reactiveValues()
  df1$Data <- readRDS("zallsp.rds")
  ## note this is the same dataset as 'zall.rds' that only contains Genus, Species, Year, Habitat, and lat & lng
  ## save this dataset inside server to make it a "reactive dataset" for further processing
  ## this data is used for "Species Explorer" & "Data Management"



  ### Here is the UI framework ###

  # this design intends to seperate user flow by different user credentials
  # but it requires refresh the webpage for re-login
  # maybe due to the 'observe' call in UI
  afterloginUI <- reactive({
    req(credentials()$user_auth)

    if (user_info()$permissions == "admin") {

      fluidPage(
        tabsetPanel(type = "tabs",
                    tabPanel("Interactive Habitat", uiOutput("habitat_map")),

                    tabPanel("Species Explorer",
                             fluidRow(
                               column(3,
                                      selectInput(inputId = "genus", label = "Genus Input",
                                                  choices = unique(df1$Data$Genus), multiple = TRUE,
                                                  selected = 'Paracalanus')),
                               column(3,
                                      selectInput("species", "Species Input",
                                                  choices = unique(df1$Data$Species), multiple=TRUE)
                               ),

                               column(3,
                                      selectInput("year", "Year by Species",
                                                  choices = unique(df1$Data$Year), multiple=TRUE)
                               ),
                               column(3,
                                      downloadButton(outputId = "dl", label = "Download Image")
                               ),
                               uiOutput("species_dis")
                             )
                    ),

                    # ideally, editor and admin can edit the database
                    tabPanel("Data Management",
                             tags$head(tags$style(HTML('
                            .modal-lg {
                            width: 1200px;
                            }
                            '))),
                             helpText("Note: Remember to save any updates!"),
                             useShinyalert(),
                             uiOutput("MainBody_trich"),
                             actionButton(inputId = "Updated_trich",
                                          label = "Save to server"))
        )
      )

    } else if (user_info()$permissions == "standard") {

      fluidPage(
        tabsetPanel(type = "tabs",
                    tabPanel("Habitat", uiOutput("habitat_map")),

                    #tabPanel("Test", uiOutput("testUI")),
                    tabPanel("Species explorer",
                             fluidRow(
                               column(3,
                                      selectInput(inputId = "genus", label = "Genus Input",
                                                  choices = unique(df1$Data$Genus), multiple = TRUE,
                                                  selected = 'Paracalanus')),
                               column(3,
                                      selectInput("species", "Species Input",
                                                  choices = unique(df1$Data$Species), multiple=TRUE)
                               ),

                               column(3,
                                      selectInput("year", "Year by Species",
                                                  choices = unique(df1$Data$Year), multiple=TRUE)
                               ),
                               column(3,
                                      downloadButton(outputId = "dl", label = "Download Image")
                               ),
                               uiOutput("species_dis")
                             )
                    )
        )
      )
    }
  })


  output$habitat_map <- renderUI({
    fluidPage(
      leafletOutput("map", width = "100%", height = 600)
    )
  })

  output$map <- renderLeaflet({
    leaflet(df) %>%

      # Base Groups and Multiple Map Tiles
      addProviderTiles("CartoDB", group = "CartoDB") %>%
      addProviderTiles("Esri.WorldImagery", group = "Esri") %>%
      addMiniMap(tiles = providers$Esri.WorldStreetMap, toggleDisplay = TRUE) %>%


      addLayersControl(baseGroups = c("CartoDB", "Esri"),
                       overlayGroups = c("Cluster", "Coastal water", "Demersal", "Hard substrata", "Mangrove",
                                         "Rocky shore", "Seagrass bed", "Soft shore"),
                       position = "topright",
                       options = layersControlOptions(collapsed = FALSE)) %>%
      setView(lng = 114.165489, lat = 22.385003, zoom = 11) %>%
      addResetMapButton() %>%

      # These markers are used for cluster analysis and point search function
      addMarkers(
        data = df, lng = ~longitude, lat = ~latitude, label = ~paste0(Name, "(", Year, ")"),
        popup = ~paste0("<h6>", Name, "</h6>",
                        "<b>", Habitat, "</b>", "<br/>", Year),
        group = "Cluster",

        ## Hereby use the Greedy Clustering Method
        clusterOptions = markerClusterOptions(riseOnHover = TRUE, opacity = 0.75,
                                              iconCreateFunction =
                                                JS("function (cluster) {
                                                                    var childCount = cluster.getChildCount();
                                                                    var c = ' marker-cluster-';
                                                                    if (childCount < 134) {
                                                                    c += 'small';
                                                                    } else if (childCount < 1000) {
                                                                    c += 'medium';
                                                                    } else {
                                                                    c += 'large';
                                                                    }
                                                                    return new L.DivIcon({ html: '<div><span>' + childCount + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(40, 40) });
  }"))
      ) %>%
      addSearchFeatures(targetGroups = "Cluster", options = searchFeaturesOptions(
        zoom = 20, autoResize = FALSE,
        autoCollapse = FALSE, hideMarkerOnCollapse = TRUE
      )) %>%

      # Add Habitat Overview map

      addCircleMarkers(data = df %>% filter(Habitat == "Coastal water"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Coastal water") %>%

      addCircleMarkers(data = df %>% filter(Habitat == "Demersal"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Demersal") %>%

      addCircleMarkers(data = df %>% filter(Habitat == "Hard substrata"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Hard substrata") %>%

      addCircleMarkers(data = df %>% filter(Habitat == "Mangrove"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Mangrove") %>%

      addCircleMarkers(data = df %>% filter(Habitat == "Rocky shore"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Rocky shore") %>%

      addCircleMarkers(data = df %>% filter(Habitat == "Seagrass bed"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Seagrass bed") %>%

      addCircleMarkers(data = df %>% filter(Habitat == "Soft shore"),
                       radius = 1, lng = ~longitude, lat = ~latitude,
                       color = ~pal(Habitat), group = "Soft shore") %>%

      addLegend(position = "bottomleft", pal = pal,
                values = c("Coastal water", "Demersal", "Hard substrata", "Mangrove",
                           "Rocky shore", "Seagrass bed", "Soft shore")) %>%

      addEasyButton(easyButton(
        icon="fa-crosshairs", title="Locate Me",
        onClick=JS("function(btn, map){ map.locate({setView: true}); }")))
  })

  output$species_dis <- renderUI({
    fluidPage(
      leafletOutput(outputId = "species_map", width = "100%", height = 540)
    )
  })



## Be aware to differentiate the 'df' & 'df1' here
  observe({
    species <- if (is.null(input$genus)) character(0) else {
      filter(df1$Data, Genus %in% input$genus) %>%
        \`$\`('Species') %>%
        unique() %>%
        sort()
    }
    stillSelected <- isolate(input$species[input$species %in% species])
    updateSelectInput(session, "species", choices = species,
                      selected = stillSelected)
  })

  observe({
    year <- if (is.null(input$genus)) character(0) else {
      df1$Data %>%
        filter(Genus %in% input$genus,
               is.null(input$species) | Species %in% input$species) %>%
        \`$\`('Year') %>%
        unique() %>%
        sort()
    }
    stillSelected <- isolate(input$year[input$year %in% year])
    updateSelectInput(session, "year", choices = year,
                      selected = stillSelected)
  })

  base_map <- reactive({
    req(input$genus)
    leaflet(df1$Data %>%
              filter(is.null(input$genus) | Genus %in% input$genus,
                     is.null(input$species) | Species %in% input$species,
                     is.null(input$year) | Year %in% input$year)) %>%

      addProviderTiles("Esri.WorldImagery", group = "Esri") %>%

      addCircleMarkers(lng = ~longitude, lat = ~latitude, radius = 6,
                       fillOpacity = 1, stroke = FALSE, color = ~pal(Habitat),
                       popup = ~paste0("<h4>", Genus, "<h4>", Species, "</h4>",
                                       "<b>", Habitat, "</b>", "<br/>", Year)) %>%
      addLegend(position = "bottomleft", pal = pal,
                values = c("Coastal water", "Demersal", "Hard substrata", "Mangrove",
                           "Rocky shore", "Seagrass bed", "Soft shore")) %>%

      addMiniMap(tiles = providers$Esri.WorldStreetMap, toggleDisplay = TRUE) %>%
      addResetMapButton()
  })

  output$species_map <- leaflet::renderLeaflet({
    base_map()
  })

  user_map <- reactive({
    base_map()
  })

  output$dl <- downloadHandler(
    filename = function() {
      paste(Sys.Date(), "_exported_map", ".png")
    },

    content = function(file) {
      mapshot(x = user_map(), file = file, selfcontained = FALSE)
    }
  )

  vals_trich <- reactiveValues()
  vals_trich$Data <- readRDS("zallsp.rds") 
  ## note this is the same dataset as 'zall.rds' that only contains Genus, Species, Year, Habitat, and lat & lng
  ## save this dataset inside server to make it a "reactive dataset" for further processing
  ## this is one of the key designs for this app


  #### MainBody_trich is the id of DT table
  output$MainBody_trich <- renderUI({
    fluidPage(
      #hr(),
      column(6,offset = 6,
             HTML('<div class="btn-group" role="group" aria-label="Basic example" style = "padding:10px">'),

             ### tags$head() This is to change the color of "Add a new row" button
             tags$head(tags$style(".butt2{background-color:#231651;} .butt2{color: #e6ebef;}")),
             div(style="display:inline-block;width:30%;text-align: center;",
                 actionButton(inputId = "Add_row_head",label = "Add", class="butt2")),

             tags$head(tags$style(".butt4{background-color:#4d1566;} .butt4{color: #e6ebef;}")),
             div(style="display:inline-block;width:30%;text-align: center;",
                 actionButton(inputId = "mod_row_head",label = "Edit", class="butt4")),

             tags$head(tags$style(".butt3{background-color:#590b25;} .butt3{color: #e6ebef;}")),
             div(style="display:inline-block;width:30%;text-align: center;",
                 actionButton(inputId = "Del_row_head",label = "Delete", class="butt3")),

             HTML('</div>')
             ),

      column(12, DT::dataTableOutput("Main_table_trich")
             ),
      tags$script("$(document).on('click', '#Main_table_trich button', function () {
                    Shiny.onInputChange('lastClickId',this.id);
                    Shiny.onInputChange('lastClick', Math.random()) });")

    )
  })

  ### save to RDS part
  observeEvent(input$Updated_trich, {
    saveRDS(vals_trich$Data, "zallsp.rds")
    ## the logic behind is to rewrite the 'zallsp.rds' file
    ## and this approach will not affect the general 'Habitat Map' in the first tabpanel    
    shinyalert(title = "Saved!", type = "success")
  })

  #### render DataTable part
  output$Main_table_trich<-renderDataTable({
    DT = vals_trich$Data
    datatable(DT,selection = 'single',
              escape = FALSE, options = list(searchHighlight = TRUE))
  })


  observeEvent(input$Add_row_head, {

    ### This is the pop up board for input a new row
    showModal(modalDialog(title = "Add a new row",
                          textInput(paste0("Genus_add", input$Add_row_head), "Genus"),
                          textInput(paste0("Species_add", input$Add_row_head), "Species"),
                          numericInput(paste0("Year_add", input$Add_row_head), "Year:", 1997),
                          selectInput(paste0("Habitat_add", input$Add_row_head), "Habitat:",
                                      choices=c("Coastal water", "Demersal", "Hard substrata", "Mangrove",
                                                "Rocky shore", "Seagrass bed", "Soft shore")),
                          numericInput(paste0("latitude_add", input$Add_row_head), "latitude:", 1),
                          numericInput(paste0("longitude_add", input$Add_row_head), "longitude:", 1),
                          actionButton("go", "Add item"),
                          easyClose = TRUE, footer = NULL ))

  })

  ### Add a new row to DT
  observeEvent(input$go, {
    new_row = data.frame(
      #      Date=as.character( input[[paste0("Date_add", input$Add_row_head)]] ),
      Genus=input[[paste0("Genus_add", input$Add_row_head)]],
      Species=input[[paste0("Species_add", input$Add_row_head)]],
      Year=input[[paste0("Year_add", input$Add_row_head)]],
      Habitat=input[[paste0("Habitat_add", input$Add_row_head)]],
      latitude=input[[paste0("latitude_add", input$Add_row_head)]],
      longitude=input[[paste0("longitude_add", input$Add_row_head)]]
    )
    vals_trich$Data <- data.table(rbind(vals_trich$Data, new_row ) )
    removeModal()
  })


  ### delete selected rows part
  ### this is warning messge for deleting
  observeEvent(input$Del_row_head,{
    showModal(
      if(length(input$Main_table_trich_rows_selected)>=1 ) {
        modalDialog(
          title = "Warning",
          paste("Are you sure delete",length(input$Main_table_trich_rows_selected),"rows?" ),
          footer = tagList(
            modalButton("Cancel"),
            actionButton("ok", "Yes")
          ), easyClose = TRUE)
      }
      else {
        modalDialog(
          title = "Warning",
          paste("Please select row(s) that you want to delect!" ),
          easyClose = TRUE
        )
      }
    )
  })

  ### If user say OK, then delete the selected rows
  observeEvent(input$ok, {
    vals_trich$Data = vals_trich$Data[-input$Main_table_trich_rows_selected]
    removeModal()
  })

  ### edit button
  observeEvent(input$mod_row_head,{
    showModal(
      if (length(input$Main_table_trich_rows_selected)>=1 ) {
        modalDialog(
          fluidPage(
            h3(strong("Modification"),align="center"),
            hr(),
            dataTableOutput('row_modif'),
            actionButton("save_changes","Save changes"),
            tags$script(HTML("$(document).on('click', '#save_changes', function () {
                             var list_value=[]
                             for (i = 0; i < $( '.new_input' ).length; i++)
                             {
                             list_value.push($( '.new_input' )[i].value)
                             }
                             Shiny.onInputChange('newValue', list_value) });")) ), size="l" )
      }
      else {
        modalDialog(
          title = "Warning",
          paste("Please select the row that you want to edit!"),
          easyClose = TRUE
        )
      }
    )
  })

  #### modify part
  output$row_modif<-renderDataTable({
    selected_row = input$Main_table_trich_rows_selected
    old_row = vals_trich$Data[selected_row]
    row_change = list()
    for (i in colnames(old_row))
    {
      if (is.numeric(vals_trich$Data[[i]]))
      {
        row_change[[i]] <- paste0('<input class="new_input" value= ','"',old_row[[i]],'"','  type="number" id=new_',i,' ><br>')
      }
      else{
        row_change[[i]] <- paste0('<input class="new_input" value= ','"',old_row[[i]],'"',' type="textarea"  id=new_',i,'><br>')
      }
    }
    row_change = as.data.table(row_change)
    setnames(row_change,colnames(old_row))
    DT = row_change
    DT
  },
  escape = FALSE,
  options = list(dom = 't', ordering = F,scrollX = TRUE), selection = "none" )



  ### This is to replace the modified row to existing row
  observeEvent(input$newValue,
               {
                 newValue = lapply(input$newValue, function(col) {
                   if (suppressWarnings(all(!is.na(as.numeric(as.character(col)))))) {
                     as.numeric(as.character(col))
                   } else {
                     col
                   }
                 })
                 DF = data.frame(lapply(newValue, function(x) t(data.frame(x))))
                 colnames(DF) = colnames(vals_trich$Data)
                 vals_trich$Data[input$Main_table_trich_rows_selected] <- DF
               }
  )

}

shinyApp(ui, server)` });
	return analyzer;
};
