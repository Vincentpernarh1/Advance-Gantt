import "./../style/visual.less";
import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

export class Visual implements IVisual {
    private target: HTMLElement;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
    }

    public update(options: VisualUpdateOptions) {
        this.target.innerHTML = "";

        const dataView = options.dataViews?.[0];
        const categorical = dataView?.categorical;
        const categories = categorical?.categories;
        const values = categorical?.values;

        if (!categories?.length || !values?.length) return;

        const hasCategory = categories.length >= 2;
        const categoryValues = hasCategory ? categories[0].values.map(String) : [];
        const taskValues = hasCategory ? categories[1].values.map(String) : categories[0].values.map(String);
        const startDates = categories[hasCategory ? 2 : 1]?.values.map(v => new Date(v as string)) || [];
        const endDates = categories[hasCategory ? 3 : 2]?.values.map(v => new Date(v as string)) || [];
        const plannedStartDates = categories[hasCategory ? 4 : 3]?.values.map(v => v ? new Date(v as string) : null) || [];
        const plannedEndDates = categories[hasCategory ? 5 : 4]?.values.map(v => v ? new Date(v as string) : null) || [];
        const milestoneDates = categories[hasCategory ? 6 : 5]?.values.map(v => v ? new Date(v as string) : null) || [];
        const progressValues = values[0]?.values as number[] | undefined;

        const categoryName = hasCategory ? categories[0].source.displayName : "Category";
        const taskName = hasCategory ? categories[1].source.displayName : categories[0].source.displayName;

        const width = options.viewport.width;
        const height = options.viewport.height;

        const labelWidth = 120;
        const taskColWidth = 180;
        const rowHeight = 50;
        const headerHeight = 60;

        const allDates = [...startDates, ...endDates, ...plannedStartDates, ...plannedEndDates, ...milestoneDates]
            .filter(d => d && !isNaN(d.getTime()));

        const minDate = d3.min(allDates)!;
        const maxDate = d3.max(allDates)!;
        const startYear = minDate.getFullYear();
        const endYear = maxDate.getFullYear();

        const timeScale = d3.scaleTime()
            .domain([new Date(startYear, 0, 1), new Date(endYear, 11, 31)])
            .range([0, 4600]);

        const taskList = taskValues.map((task, idx) => ({
            index: idx,
            task,
            category: hasCategory ? categoryValues[idx] : "",
            startDate: startDates[idx],
        })).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        const container = d3.select(this.target)
            .append("div")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("height", `${height}px`)
            .style("font-family", "sans-serif");

            

        // === HEADER ROW ===
        const headerRow = container.append("div")
            .style("display", "flex")
            .style("width", "100%")
            .style("height", `${headerHeight}px`)
            .style("flex-shrink", "0"); // or any shade like "#007bff"


        const fixedHeader = headerRow.append("div")
            .style("width", `${labelWidth + taskColWidth-107}px`)
            .style("height", "100%")
            .style("flex-shrink", "0")
            .style("overflow", "hidden");



        const fixedHeaderSvg = fixedHeader.append("svg")
            .attr("width", labelWidth + taskColWidth-107)
            .style("background-color", "#03045e") // or any shade like "#007bff"
            .attr("height", headerHeight);

        fixedHeaderSvg.append("text")
            .attr("x", 10)
            .attr("y", (headerHeight / 2))
            .attr("font-weight", "bold")
            .attr("font-size", "14px")
            .attr("fill","white")
            .text(categoryName);

        fixedHeaderSvg.append("text")
            .attr("x", labelWidth)
            .attr("y", (headerHeight / 2))
            .attr("font-weight", "bold")
            .attr("fill","white")
            .attr("font-size", "14px")
            .text(taskName);


        const headerWrapper = headerRow.append("div")
            .style("overflow-x", "auto")
            .style("overflow-y", "hidden")
            .style("flex", "1")
            .style("scrollbar-width", "none")        // Firefox
            .style("-ms-overflow-style", "none")     // IE & Edge
            .style("position", "relative");

        const headerSvg = headerWrapper.append("svg")
            .attr("width", timeScale.range()[1])
            .attr("height", headerHeight)
            .style("background", "#f9f9f9");

        // === BODY ROW ===
        const bodyRow = container.append("div")
            .style("display", "flex")
            .style("flex", "1")
            //.style("background-color","red")
            .style("overflow", "hidden");

        const fixedColumn = bodyRow.append("div")
            .style("width", `${taskColWidth+20}px`)
            .style("overflow-y", "hidden")
            .style("overflow-x", "hidden")
            .style("position", "relative");

        const rightWrapper = bodyRow.append("div")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("flex", "1")
            .style("overflow", "hidden");

        const scrollableWrapper = rightWrapper.append("div")
            .attr("class", "scrollable-wrapper")
            .style("flex", "1")
            .style("overflow", "auto")
            .style("scrollbar-width", "none")        // Firefox
            .style("-ms-overflow-style", "none")     // IE & Edge
            .style("position", "relative");
        

        const totalHeight = taskList.length * rowHeight+20;
        const totalWidth = timeScale.range()[1];

        const fixedSvg = fixedColumn.append("svg")
            .attr("width", labelWidth + taskColWidth)
            .attr("height", totalHeight);

        

        const scrollableSvg = scrollableWrapper.append("svg")
            .attr("width", totalWidth)
            .attr("height", totalHeight-30);

        const tooltip = d3.select(this.target).append("div")
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.75)")
            .style("color", "#fff")
            .style("padding", "6px 10px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("visibility", "hidden");

        const formatDate = d3.timeFormat("%Y-%m-%d");
        const headerGroup = headerSvg.append("g")
            .attr("transform", `translate(0, -38)`);

        const monthFormatter = d3.timeFormat("%b");

        for (let year = startYear; year <= endYear; year++) {
            for (let month = 0; month < 12; month++) {
                const date = new Date(year, month, 1);
                const x = timeScale(date);
                headerGroup.append("text")
                    .attr("x", x)
                    .attr("y", 78)
                    .attr("font-size", "10px")
                    .text(monthFormatter(date));

                    headerGroup.append("line")
                    .attr("x1", x-20)
                    .attr("x2", x)
                    .attr("y1", 61)
                    .attr("y2", totalHeight)
                    .attr("stroke", "red")
                    .attr("stroke-dasharray","3,3")
                    .attr("stroke-width", 0.5);
            }

            const startX = timeScale(new Date(year, 0, 1));
            const endX = timeScale(new Date(year + 1, 0, 1));
            
                    // Add the centered year text
                    const text = headerGroup.append("text")
                    .attr("x", ((startX + endX) / 2))
                    .attr("y", headerHeight - 5)
                    .attr("font-weight", "bold")
                    .attr("text-anchor", "middle")
                    .attr("fill", "white")
                    .attr("font-size", "13px")
                    .text(year.toString());
                
                // Get bounding box of text
                const bbox = text.node().getBBox();
                
                // Append a rect behind the text
                headerGroup.insert("rect", "text") // inserts before the <text> element
                    .attr("x", bbox.x - 1000)
                    .attr("y", bbox.y - 8)
                    .attr("width", bbox.width + 10000)
                    .attr("height", bbox.height+12)
                    .attr("fill", "#03045e")
                    .attr("rx", 2); // optional rounded corners
                
                

            // First vertical base line
            headerGroup.append("line")
                .attr("x1", startX - 20)
                .attr("x2", startX - 20)
                .attr("y1", -headerHeight)
                .attr("y2", totalHeight)
                .attr("stroke", "blue");

            // Now add the horizontal base line below
            headerGroup.append("line")
                .attr("x1", startX)             // start of horizontal line
                .attr("x2", startX + 1000)      // end of horizontal line
                .attr("y1", 60)                 // Y position of the line
                .attr("y2", 60)
                .attr("stroke", "blue")
                .attr("stroke-width", 0.5);

        }

        
        taskList.forEach(({ index: i, task, category }, row) => {
            const y = row * rowHeight;
            const barHeight = 14;
            const spacingBetweenBars = 1;
        
            const hasPlanned = plannedStartDates[i] && plannedEndDates[i];
            const actualStart = timeScale(startDates[i]);
            const actualEnd = timeScale(endDates[i]);
            const actualWidth = actualEnd - actualStart;
        
            const plannedStart = hasPlanned ? timeScale(plannedStartDates[i]!) : null;
            const plannedEnd = hasPlanned ? timeScale(plannedEndDates[i]!) : null;
            const plannedWidth = hasPlanned ? plannedEnd! - plannedStart! : 0;
        
            // Compute Y positions
            let plannedBarY: number | null = null;
            let actualBarY: number;
        
            if (hasPlanned) {
                const totalHeight = 2 * barHeight + spacingBetweenBars;
                plannedBarY = y + (rowHeight - totalHeight) / 2;
                actualBarY = plannedBarY + barHeight + spacingBetweenBars;
            } else {
                actualBarY = y + (rowHeight - barHeight) / 2;
            }
        
            const progressPercent = progressValues?.[i] ?? null;
            const progressWidth = 0;

            for (let year = startYear; year <= endYear; year++) {
                for (let month = 0; month < 12; month++) {
                    const date = new Date(year, month, 1);
                    const x = timeScale(date);

                    scrollableSvg.append("line")
                    .attr("x1", x-25)
                    .attr("x2",  x-25)
                    .attr("y1", -20)
                    .attr("y2", totalHeight)
                    //.attr("stroke", "#ffe3f6")
                    .attr("stroke-dasharray","2,1")
                    .attr("stroke-width", 0.2);
    
                    }
            }
        
            if (hasCategory) {
                fixedSvg.append("text")
                    .attr("x", 10)
                    .attr("y", y + rowHeight / 2 + 5)
                    .attr("font-size", "12px")
                    .text(category);
            }
        
            fixedSvg.append("text")
                .attr("x", labelWidth)
                .attr("y", y + rowHeight / 2 + 5)
                .attr("font-size", "12px")
                .text(task);
        
            fixedSvg.append("line")
                .attr("x1", 0)
                .attr("x2", labelWidth + taskColWidth + 5)
                .attr("y1", y + rowHeight)
                .attr("y2", y + rowHeight)
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1);
        
            if (hasPlanned && plannedStart !== null) {
                scrollableSvg.append("rect")
                    .attr("x", plannedStart)
                    .attr("y", plannedBarY!)
                    .attr("width", Math.max(1, plannedWidth))
                    .attr("height", barHeight)
                    .attr("fill", "#094780");
            }
        
            scrollableSvg.append("rect")
                .attr("x", actualStart)
                .attr("y", actualBarY)
                .attr("width", Math.max(1, actualWidth))
                .attr("height", barHeight)
                .attr("fill", "steelblue");
        
            scrollableSvg.append("line")
                .attr("x1", 0)
                .attr("x2", totalWidth)
                .attr("y1", y + rowHeight)
                .attr("y2", y + rowHeight)
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1);
            
        
            if (progressPercent !== null && !isNaN(progressPercent)) {
                scrollableSvg.append("rect")
                    .attr("x", actualStart)
                    .attr("y", actualBarY)
                    .attr("width", progressWidth)
                    .attr("height", barHeight)
                    .attr("fill", "limegreen");
            }
        
            const milestone = milestoneDates?.[i];
            if (milestone && !isNaN(milestone.getTime())) {
                scrollableSvg.append("path") 
                    .attr("d", d3.symbol().type(d3.symbolTriangle).size(100))
                    .attr("transform", `translate(${timeScale(milestone)+5}, ${actualBarY + barHeight / 2}) rotate(90)`)
                    .attr("fill", "gold");
            }
        
            scrollableSvg.append("rect")
                .attr("x", actualStart)
                .attr("y", y)
                .attr("width", Math.max(1, Math.max(actualWidth, plannedWidth)))
                .attr("height", rowHeight)
                .style("fill", "transparent")
                .on("mouseover", () => tooltip.html(`
                    <strong>${task}</strong><br/>
                    ${hasCategory ? `Category: ${category}<br/>` : ""}
                    Start: ${formatDate(startDates[i])}<br/>
                    End: ${formatDate(endDates[i])}<br/>
                    ${hasPlanned ? `Planned Start: ${formatDate(plannedStartDates[i]!)}<br/>` : ""}
                    ${hasPlanned ? `Planned End: ${formatDate(plannedEndDates[i]!)}<br/>` : ""}
                    ${progressPercent !== null ? `Progress: ${progressPercent}%` : ""}
                `).style("visibility", "visible"))
                .on("mousemove", (event: MouseEvent) => {
                    tooltip
                        .style("top", (event.pageY + 10) + "px")
                        .style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", () => tooltip.style("visibility", "hidden"));
        });
        

        const todayX = timeScale(new Date());
        scrollableSvg.append("line")
            .attr("x1", todayX)
            .attr("x2", todayX)
            .attr("y1", 0)
            .attr("y2", totalHeight)
            .attr("stroke", "black")
            .attr("stroke-dasharray", "3,3");

        const fixedColumnEl = fixedColumn.node() as HTMLElement;
        const scrollableWrapperEl = scrollableWrapper.node() as HTMLElement;
        const headerWrapperEl = headerWrapper.node() as HTMLElement;

        scrollableWrapperEl.addEventListener("scroll", () => {
            fixedColumnEl.scrollTop = scrollableWrapperEl.scrollTop;
            headerWrapperEl.scrollLeft = scrollableWrapperEl.scrollLeft;
        });
    }
}
