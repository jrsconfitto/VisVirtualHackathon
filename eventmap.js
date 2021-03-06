// Exele Information System Inc, TreeMap for the OSIsoft LLC 2017 hackathon.
// Main function that does the Exele Tree logic
function EventMap() {
    //****Private variables
    let templates = [];
    let efDataHolder = {};
    let myel = {};
    let symbolElement = {};
    let webAPIServerURL = '';
    var _template = '';
    var _sizeAttribute = '';
    var _colorAttribute = '';

    let numericalAttributeTypes = [
        'Double',
        'Int16',
        'Int32',
        'Int64',
        'Single'
    ];

    //**********public setters***********
    // sets the tree symbol
    this.SetSymbol = function (treeSymbolElement) {
        symbolElement = treeSymbolElement;
    }
    // sets the WebAPI server
    this.SetWebAPIURL = function (url) {
        webAPIServerURL = url;
    }
    //set the global template to display
    this.SetTemplate = function (template) {
        _template = template;
    }
    this.SetSizeAttribute = function (sizeAttribute) {
        _sizeAttribute = sizeAttribute;
    }
    this.SetColorAttribute = function (colorAttribute) {
        _colorAttribute = colorAttribute;
    }

    // used to return all of the EF templates used as array
    this.GetTemplates = function () {
        var templates = [];
        //["None"];
        for (var t in efDataHolder) {
            templates.push(t);
        }
        return templates;
    }

    // use to return the attributes as array given a template
    this.GetEFAttributesFromTemplate = function (templateName) {
        if (efDataHolder[templateName] && efDataHolder[templateName].attributes) {
            return efDataHolder[templateName].attributes;
        }
        // Return an empty array if we don't find a match
        return [];
    }

    // main function that builds up the EF data
    // gets the element, gets the EF on the element
    this.GetEFData = function (elementPath, startTime, endTime) {
        // First make a call to get the element using PI Web API
        let url = webAPIServerURL + '/' + "elements?path=" + elementPath + "&selectedFields=Name;Path;WebId;Links.EventFrames";
        makeDataCall(url, 'get', null, PathResults, error);

        // get the results, create a mock element, and call function to get the EF
        function PathResults(results) {
            myel = new myElement(results.Name, results.Path, results.WebId, results.Links.EventFrames);
            GETEFByElementID(myel.framesLink, startTime, endTime, ExtractEF);
        }
        // get the resulting EF within the time range, and calls ExtractEF when completed
        function GETEFByElementID(elementIDbase, startTime, endtime, successCallBack) {
            url = elementIDbase + "?StartTime=" + startTime + "&" + "Endtime=" + endtime + "&searchmode=StartInclusive&selectedFields=Items.StartTime;Items.EndTime;Items.Name;Items.WebId;Items.TemplateName;Items.Links.Template";
            this.symbolElement = symbolElement;
            makeDataCall(url, 'get', null, successCallBack, error);
        }
        function error(result) {
            console.log(error);
        }
    }

    //*********Internal functions******************

    // Modeled after the example given in Mike Bostock's fantastic "Towards Reusable Charts": https://bost.ocks.org/mike/chart/
    //
    // This pattern allows us to create (lots of) treemaps easily and update their data (and other attributes) by calling this function with new data (or new chart attributes).

    function treemap() {
        var width = 960,
            height = 570;

        // A helper method that allows us to set the width of the chart.
        // This passes back itself to allow function chaining. Ex: var myTreeMap = treemap().width(900).height(400);
        treemap.width = function (value) {
            if (!arguments.length) return width
            width = value
            return treemap;
        };

        // Same as above, but for height
        treemap.height = function (value) {
            if (!arguments.length) return height
            height = value
            return treemap;
        };

        // This is the main logic of the treemap, it modifies the data (should be a d3.hierarchy of some sort), applies
        // it to the passed selection (i.e. where the visualization should go), and constructs the treemap visualization.
        function treemap(selection) {
            // d3 selections are the main way to apply data to HTML elements: https://github.com/d3/d3-selection/blob/master/README.md
            //
            // The following code applies the data tied to the passed in selection(s) and is where we actually build the
            // treemap.
            selection.each(function (data) {
                var format = d3.format(",d");

                var colorStyle = data.data.colorType;
                var color;
                if (colorStyle === 'sequential') {
                    color = d3.scaleSequential(d3.interpolateBlues).domain(data.data.colorDomain);
                } else {
                    var fader = function (color) { return d3.interpolateRgb(color, "#fff")(0.2); };
                    color = d3.scaleOrdinal(d3.schemeCategory20.map(fader));
                }

                // Create a function that will format the treemap's data according to the
                // way we want it displayed
                var treemap = d3.treemap()
                    .tile(d3.treemapResquarify)
                    .size([width, height])
                    .round(true)
                    .paddingInner(1);

                // Run the treemap function over the data. This runs through the data hierarchy calculating
                // the sizes and positions of the cells based on the sum, sort, and other criteria of the hierarchy.
                treemap(data);

                // Select the div tag that will be the parent of our treemap
                var parentDiv = d3.select(this);

                // this code selects all of the d3 elements and removes everything.  Ideally, we use enter(), update() and exit()
                parentDiv.selectAll("*").remove();

                // Since everything under the parent div was removed, add an svg element and set its height and width according
                // to the settings passed into this chart earlier.
                var svg = parentDiv.selectAll('svg')
                    .data([data])
                  .enter().append('svg')
                    .attr('width', width)
                    .attr('height', height);

                // This creates a cell ('g' element) for each box (i.e. EventFrame) to be put into the treemap
                var cell = svg.selectAll('g')
                    .data(function (d) {
                        return d.leaves();
                    })
                  .enter().append("g")
                    .attr("transform", function (d) {
                        return "translate(" + d.x0 + "," + d.y0 + ")";
                    })
                    .on('click', function (d) {
                        // Build attribute table for clicked event frame
                        buildTable(d.data.ef);
                    });

                cell.append("rect")
                    .attr("id", function (d) { return d.data.id; })
                    .attr("width", function (d) { return d.x1 - d.x0; })
                    .attr("height", function (d) { return d.y1 - d.y0; })
                    .attr("fill", function (d) {
                        return color(d.data.colorAttributeName !== 'None' ? d.data.colorValue : d.parent.data.name);
                    })
                    .attr("data-web-id", function (d) { return d.data.ef.webId; });

                cell.append("clipPath")
                    .attr("id", function (d) { return "clip-" + d.data.id; })
                  .append("use")
                    .attr("xlink:href", function (d) { return "#" + d.data.id; });

                cell.append("text")
                    .attr("clip-path", function (d) { return "url(#clip-" + d.data.id + ")"; })
                    .attr('x', 1)
                    .attr('y', 1)
                    .attr('w', function (d) { return d.x1 - d.x0; })
                    .attr('dy', '1em')

                cell.append("title")
                    .text(function (d) {
                        var title = d.data.name
                            + '\nTemplate: ' + d.data.ef.templateName
                            + '\nDuration: ' + format(d.data.durationMinutes) + ' minutes'
                            + '\nStart: ' + d.data.startTime.toLocaleString()
                            + '\nEnd: ' + d.data.endTime.toLocaleString();

                        if (_sizeAttribute !== 'None') {
                            title += '\n\n(Sizing by: ' + d.data.sizeAttributeName + ')';
                            title += '\n\t' + d.data.sizeAttributeName + ' Value: ' + d.data.sizeValue;
                        }

                        if (_colorAttribute !== 'None') {
                            title += '\n\n(Coloring by: ' + _colorAttribute + ')';
                            title += '\n\t' + d.data.colorAttributeName + ' Value: ' + d.data.colorValue;
                        }

                        return title;
                    });

                cell.selectAll('text')
                    .call(wrap);
            });
        }

        function wrap(text) {
            text.each(function () {
                var text = d3.select(this),
                    datum = text.datum().data,
                    words = datum.name.split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    y = text.attr("y"),
                    w = text.attr("w"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > w) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }

        // Return a treemap function that someone can call to add data to
        return treemap;
    }


    function resetTable() {

        // Create empty attribute table
        var tableContent = '<table class="exele-attr-table exele-table-a"><tr><th>Attribute</th><th>Value</th></tr>';
        tableContent += '<tr><td>---</td><td class="exele-table-value">---</td></tr>';
        tableContent += '<tr><td>---</td><td class="exele-table-value">---</td></tr>';
        tableContent += '<tr><td>---</td><td class="exele-table-value">---</td></tr>';
        tableContent += '</table>';

        // Replace contents of existing table
        $('.exele-attr-table', symbolElement).replaceWith(tableContent);

    }

    function buildTable(ef) {

        GetSingleEFAttributes(ef.webId).then(results=> {

            // Create HTML for table and header
            var tableContent = '<table class="exele-attr-table exele-table-a"><tr><th>Attribute</th><th>Value</th></tr>';

            results.Items.forEach(attr=> {

                var entry = {};

                if (typeof attr.Value.Value === 'object') {
                    if (attr.Value.Value.hasOwnProperty('Name')) {
                        entry.Value = attr.Value.Value.Name;
                    }
                } else {
                    entry.Value = attr.Value.Value;
                }

                if (Number(entry.Value) === entry.Value && entry.Value % 1 !== 0) {
                    entry.Value = entry.Value.toFixed(3);
                }

                // Add unit abbreviations, if available
                if (attr.Value.UnitsAbbreviation) {
                    entry.Value = entry.Value.toString() + ' ' + attr.Value.UnitsAbbreviation;
                }

                tableContent += '<tr><td>' + attr.Name + '</td><td class="exele-table-value">' + entry.Value + '</td></tr>';

            });

            // Close table and replace contents of existing table
            tableContent += '</table>';
            $('.exele-attr-table', symbolElement).replaceWith(tableContent);

        }, error=>console.log(error));

    }


    // creates an eventframe object that is used by the holder
    function myEventFrame(name, TemplateName, startTime, endTime, templatelink, webId) {
        this.name = name;
        this.templateName = TemplateName;
        this.StartTime = new Date(startTime);
        // checks if the EF is still open, and if so, set the endtime to *, and inprocess to true
        if (endTime === "9999-12-31T23:59:59Z") {
            this.EndTime = new Date()
            this.InProcess = true;
        } else {
            this.EndTime = new Date(endTime);
            this.InProcess = false;
        }
        this.TemplateLink = templatelink;
        this.webId = webId;
    }

    // holds an AF element
    function myElement(name, Path, webID, framesLink) {
        this.name = name;
        this.path = Path;
        this.webId = webID;
        this.framesLink = framesLink;
    }

    //

    // given webAPI results, extract the results, create EFs, and put them into efDataHolder;
    // add the event get the attributes for the templates.  Ideally we cache this and do it once.
    // This method also call methods to get all of the attribute Templates, attribute Values based on config, and builds the map
    function ExtractEF(results) {
        items = results.Items;
        //clear the cache of events
        efDataHolder = {};
        for (let item in items) {
            let apiFrameResult = items[item];

            // create a simple EF object
            let EF = new myEventFrame(apiFrameResult.Name, apiFrameResult.TemplateName, apiFrameResult.StartTime, apiFrameResult.EndTime, apiFrameResult.Links.Template, apiFrameResult.WebId);

            // if the EF template is not a property of the object, add it
            if (efDataHolder[EF.templateName] === undefined) {

                efDataHolder[EF.templateName] = {
                    "Links": apiFrameResult.Links.Template,
                    "frames": [],
                }
            }
            // for all EF, add an array of the EF with properties of id and the actual EF object
            efDataHolder[EF.templateName].frames.push({
                id: EF.webId,
                ef: EF
            });
        }
        
        // get the attribute templates to cache them here to show in the grid, we should move to own cache
        GetAllTemplateAttributes().then(templateAttributes => {
            templateAttributes.forEach(function(attributes, templateName) {
                if (efDataHolder[templateName]) {
                    efDataHolder[templateName].attributes = attributes;
                }
            });

            // Get attribute value for provide attribute and template.
            if (_template != "None" &&
                (_sizeAttribute !== "None" || _colorAttribute !== "None")) {

                // Will build the treemap after pulling down attributes' values
                GetAttributesValues(_template);

            } else {

                //reference the treeview and build it here
                BuildTreemap();

            }

        })
    }

    // Finds all the attribute names for the passed array of template names
    //
    // param `templateNames`: an array of EF template names
    //
    // returns a single promise containing an array of Objects containing a template name paired with its attribute names.
    function GetAllTemplateAttributes(templateNames) {
        // Promise.all which returns lots of templates! Converts multiple requests to a single promise result,
        // which may be desirable because this may be the first thing we want to get when looking
        // for the attributes within an EF Template for an Element.
        var templateLinkBatchCalls = Object.keys(efDataHolder).map(function(t) {
          return {
            templateName: t,
            batchRequest: {
                "Method": "GET",
                "Resource": efDataHolder[t].Links
            }
          };
        });

        // Construct the initial batch query
        let batchQuery1 = {};
        templateLinkBatchCalls.forEach((tCall, i) => {
            batchQuery1[i] = tCall.batchRequest;
        });

        return makeDataCall(webAPIServerURL + '/batch', 'POST', JSON.stringify(batchQuery1), null, null)
            .then(function(batchResponse1) {        // use the template link to get the links and call method to get attribute templates
                let batchQuery2 = {};
                for (var batchResponse in batchResponse1) {
                    batchQuery2[batchResponse] = {
                        'Method': 'GET',
                        'Resource': batchResponse1[batchResponse].Content.Links.AttributeTemplates + '?selectedFields=Items.Name;Items.Type'
                    };
                }

                let templates = this;

                return makeDataCall(webAPIServerURL + '/batch', 'POST', JSON.stringify(batchQuery2), null, null, templates)
                    .then(function(batchResponse2) {
                        var resultingTemplates = new Map();

                        for(var resp in batchResponse2) {
                            var respObj = batchResponse2[resp];
                            var templateName = this[+resp].templateName;

                            resultingTemplates.set(templateName, respObj.Content.Items);
                        }

                        return resultingTemplates;
                    }.bind(templates));
             }.bind(templateLinkBatchCalls));
    }

    //get a singleEf
    function GetSingleEFAttributes(webId) {
        let efURL = webAPIServerURL + "/streamsets/" + webId + "/value";
        return makeDataCall(efURL, "GET", null, null, null)
    }

    // get the attribute values for each EF given an attributeName and template
    function GetAttributesValues(templateName) {
        var templateUsed = efDataHolder[templateName];

        if (templateUsed) {
            // build up a bulk query that requires the ef webID and the attribute ID
            var bulkQuery = {};
            templateUsed.frames.forEach(EF => {
                var attributeURL;
                attributeURL = encodeURI(webAPIServerURL + "/streamsets/" + EF.id + "/value?selectedFields=Items.Name;Items.Value.Value");
                bulkQuery[EF.id] = {
                    "Method": "GET",
                    "Resource": attributeURL
                };
            });
            // use batch call and call method to add the attribute values as a map to the tree
            makeDataCall(webAPIServerURL + "/batch", "POST", JSON.stringify(bulkQuery), null, null)
            .then(results=>ProcessAttributeResults(results, templateName))
            .then(() => BuildTreemap());
        } else {
            BuildTreemap();
        }
    }

    // takes batch call results, and adds values to the correct EF
    function ProcessAttributeResults(results, templateName) {
        for (let result in results) {
            if (results[result].Status == 200 && results[result].Content.Items.length > 0) {
                const attributeMap = new Map();
                // add attribute values to the map.
                for (var i in results[result].Content.Items) {
                    var attributeObj = results[result].Content.Items[i];
                    attributeMap.set(attributeObj.Name, attributeObj.Value.Value);
                }

                // find the correct EF, and add the attribute value to it
                efDataHolder[templateName].frames.find(ef=>ef.id === result).attributeValuesMap = attributeMap;
            }
        }
    }

    // This converts EFs in `efDataHolder` to hierarchical data useful for treemaps
    //
    // d3 expects data passed into a treemap to have a specific structure. It must
    // be "tree-like" (James's words) and have a sense of a root and then childnodes,
    // which in turn have child nodes.
    //
    // d3-hierarchy provides more information on how to create this kind of data
    // structure: https://github.com/d3/d3-hierarchy
    function EFsToHierarchy() {
        // Determine the attribute type used for setting the color scheme, so the treemap
        // can use either discrete colors or sequential colors.
        var colorAttributeType = 'String'; // Default to a type that will use the discrete color scheme
        if (_colorAttribute !== 'None'
            && efDataHolder[_template]
            && efDataHolder[_template].attributes) {

            var matchingAttribute = efDataHolder[_template].attributes.filter(att => att.Name === _colorAttribute);
            colorAttributeType = (matchingAttribute && matchingAttribute.length === 1 && matchingAttribute[0].Type ? matchingAttribute[0].Type : 'String');
        }

        var efDataRoot = {
            name: '',
            children: [],
            colorType: (numericalAttributeTypes.indexOf(colorAttributeType) === -1 ? 'discrete' : 'sequential')
        };

        // Converts the passed EFs into data objects for use in the treemap
        function getChildrenFromFrames(frames) {
            // Since the treemap doesn't like negative values, we shift everything positive for sizing.
            // We also shift positive for coloring, for now.
            function normalizeSummingData(efs) {
                // TODO: should we be doing some sort of percentile normalization?
                var sizeValues = efs.map(ef => ef.sizeValue);

                var minSize = d3.min(sizeValues);
                var maxSize = d3.max(sizeValues);
                var minSizeAbs = Math.abs(minSize);

                if (minSize <= 0) {
                    // Then let's normalize(?) the data somehow...
                    // Add every summing value by the minimum to shift it all to positive values.
                    efs.forEach(ef => ef.sizeValue += minSizeAbs + 1);
                }
            }

            var efs = frames
                .map(function (f) {
                    // Include any attributes into the ef object
                    var color;

                    if (f.attributeValuesMap) {
                        f.ef.attributes = f.attributeValuesMap;

                        if (_colorAttribute && f.ef.attributes.has(_colorAttribute)) {
                            // Accomodate attributes whose values are objects!
                            var colorValue = f.attributeValuesMap.get(_colorAttribute);

                            if (_colorAttribute.Type === 'EnumerationValue') {
                                colorValue = colorValue.Name;
                            } else if (typeof colorValue == 'object' && colorValue.Value != null) {
                                colorValue = colorValue.Value;
                            }

                            color = {
                                attributeName: _colorAttribute,
                                value: colorValue
                            };
                        }
                    }

                    // Calculate the duration of the EF, this will also be used as the default value for summing cells
                    // for treemap display calculations.
                    var durationMinutes = ((f.ef.EndTime - f.ef.StartTime) / 1000 / 60);

                    var sizeValue;

                    // Lots of things are being verified here before we use the attribute's value for cell sizing:
                    //
                    // * Is there a selected template and attribute?
                    // * Does the template of this EF match the selected template?
                    // * Does the attributes map exist on the data point's (i.e. `d`) `ef` property?
                    // * Does the attributes map contain the selected attribute?
                    if (_template
                        && _sizeAttribute
                        && f.ef
                        && _template == f.ef.templateName
                        && f.ef.attributes
                        && f.ef.attributes.has(_sizeAttribute)) {

                        // Return the value of the selected attribute
                        sizeValue = f.ef.attributes.get(_sizeAttribute);
                    } else {
                        sizeValue = durationMinutes;
                    }

                    // The data object is what will be passed into the d3 visualization
                    // and will be the main information that the treemap has access to.
                    //
                    // If you want the visualization to have more EF-specific information
                    // available to it, add it here.
                    var data = {
                        name: f.ef.name,
                        ef: f.ef,
                        startTime: f.ef.StartTime,
                        endTime: f.ef.EndTime,
                        durationMinutes: durationMinutes,
                        sizeAttributeName: (_sizeAttribute === 'None' ? 'Duration' : _sizeAttribute),
                        sizeValue: sizeValue,
                        colorAttributeName: (color && color.attributeName ? color.attributeName : _colorAttribute),
                        colorValue: (color && color.value ? color.value : f.ef.name)
                    }

                    return data;
                });

            // Normalize the summing data, if necessary.
            if (_template && _sizeAttribute
                && _template !== 'None'
                && _sizeAttribute !== 'None') {
                normalizeSummingData(efs);
            }

            return efs;
        }

        if (_template && _template !== 'None' && efDataHolder[_template]) {

            var efs = efDataHolder[_template];

            efDataRoot.name = _template;
            efDataRoot.children = getChildrenFromFrames(efs.frames);

        } else {

            efDataRoot.name = 'EventFrames';

            // Add a node to the tree's root for each EF template, filling in each name and setting its children
            // to the EFs in each.
            for (var efName in efDataHolder) {
                var efs = efDataHolder[efName];

                var efsAsChildren = getChildrenFromFrames(efs.frames);

                efDataRoot.children.push({
                    name: efName,
                    children: efsAsChildren
                });
            }
        }

        // Might be useful to allow summing by count, in the future.
        function sumByCount(d) {
            return 1;
        }

        return d3.hierarchy(efDataRoot)
          .eachBefore(function (d) {
              d.data.id = (d.parent ? d.parent.data.id + '.' : '') + d.data.name + (d.data.ef ? '.' + d.data.ef.webId : '');
              // d.WebId = "1111"
          })
          .eachAfter(function (d) {
              // Give nodes with children `durationMinutes` properties equal to the sum of the durations of their children.
              if (d.children) {
                  d.data.durationMinutes = d.children.reduce(function (a, b) {
                      return a + b.data.durationMinutes;
                  }, 0)

                  d.data.sizeDomain = d.children.map(function (c) {

                      // Gets back the domain of the data object
                      var sizeValues = [];

                      if (c.data.sizeDomain) {
                          sizeValues.push(c.data.sizeDomain);
                      } else if (c.data.sizeValue) {
                          sizeValues.push(c.data.sizeValue);
                      }

                      return [d3.min(sizeValues), d3.max(sizeValues)];

                  }).reduce(function (a, b) {
                      b.push(a);
                      var combined = d3.merge(b);
                      return [d3.min(combined), d3.max(combined)];
                  }, [0, 0]);

                  d.data.colorDomain = d.children.reduce(function (a, b) {
                      if (b.data.colorValue) {
                          a.push(b.data.colorValue);
                      }
                      return [d3.min(a), d3.max(a)];
                  }, []);
              } else {
                  d.data.sizeDomain = [d.data.sizeValue, d.data.sizeValue];
              }
          })
          // TODO: Move this into the treemap code where i can sum based on the normalization information in the root node?
          .sum(function (d) {
              // The `sum` determines the size of the cells within the treemap.

              // From d3-hierarchy's docs on the sum function: https://github.com/d3/d3-hierarchy/blob/master/README.md#node_sum
              // > The function is passed the node’s data, and must return a non-negative number.

              // This summing function sums by:
              //
              // A selected attribute's value, if present
              //
              // OR
              //
              // The EF's duration (default)

              // Otherwise, default to summing by EF duration
              return d.sizeValue;
          })
          .sort(function (a, b) {
              // Sorts by the height (greatest distance from descendant leaf)
              // and then by value (which determines box sizes).
              return b.height - a.height || b.value - a.value;
          });
    }

    // Builds a treemap under the passed element
    function BuildTreemap() {
        // Find the div that will contain our treemap by looking for an element going by our "exele-treemap" class
        // within the symbol element.
        var $treemapParentElement = $('.exele-treemap', symbolElement);

        var width = $treemapParentElement.width(),
            height = $treemapParentElement.height();

        var treemapSelection = d3.select($treemapParentElement.get(0));

        // Set the treemap's width and height based on the calculated values above
        var myTreemap = treemap()
            .width(width)
            .height(height);

        // Extract the right Event Frames data for the Treemap
        //
        // d3 requires hierarchical data for a treemap, this means that the data should be organized in a
        // tree-like structure with nodes that may have children. From the documentation:
        //
        //   Before you can compute a hierarchical layout, you need a root node. If your data
        //   is already in a hierarchical format, such as JSON, you can pass it directly to
        //   d3.hierarchy; otherwise, you can rearrange tabular data, such as comma-separated
        //   values (CSV), into a hierarchy using d3.stratify.
        var root = EFsToHierarchy();

        // TODO: remove the following, it's duplicating calcs done in the EFs hierarchy
        var efDurationSum = function (efNode) {
            if (efNode.children) {
                // Node has children, compute duration of each child
                var childSum = 0;
                for (var i = 0; i < efNode.children.length; i++) {
                    childSum += efDurationSum(efNode.children[i]);
                }
                return childSum;
            } else {
                // Node has no children, return duration value
                return efNode.data.durationMinutes;
            }
        }

        var totalTime = {}

        if (Object.keys(efDataHolder).length === 0) {

            resetTable();
            totalTime.Value = "---"

            // Display message that no events exist within time range
            treemapSelection.selectAll("*").remove();
            treemapSelection
                .classed("no-events", true)
                .append("p")
                .text("No events within time range");

        } else {

            totalTime.Value = root.data.durationMinutes.toFixed(2) + ' minutes';

            // Draw the treemap within the selected element using the data in `root`
            treemapSelection
                .classed("no-events", false)
                .datum(root)
                .call(myTreemap);
        }

        var $totalTimeElement = $('.exele-total-time-value', symbolElement);
        $totalTimeElement[0].innerHTML = totalTime.Value;

    }
}

// *********Prototypes of EventMap************

EventMap.prototype.Update = function (APIServer, elementPath, symbolElement, startTime, endTime, template, sizeAttribute, colorAttribute) {
    // store the symbol and the apiserver as private variables in the module, we should initiallize first.
    this.SetSymbol(symbolElement);
    this.SetWebAPIURL(APIServer);
    this.SetTemplate(template);
    this.SetSizeAttribute(sizeAttribute);
    this.SetColorAttribute(colorAttribute);
    // obtain the EF data
    this.GetEFData(elementPath, startTime, endTime);
}

// get EF templates
EventMap.prototype.GetEFTemplates = function () {
    return this.GetTemplates();
}

// get the Attributes provide a tepmlate
EventMap.prototype.GetEFAttributeNamesFromTemplate = function (templateName) {
    return this.GetEFAttributesFromTemplate(templateName)
        .map(att => att.Name)
        .sort((a, b) => d3.ascending(a, b));
}

EventMap.prototype.GetNumericalEFAttributeNamesFromTemplate = function (templateName) {
    // Numerical attribute types this custom symbol supports
    var numericalAttributeTypes = [
        'Double',
        'Int16',
        'Int32',
        'Int64',
        'Single'
    ];

    // Return an empty array if we don't find a match
    return this.GetEFAttributesFromTemplate(templateName)
        .filter(att => numericalAttributeTypes.indexOf(att.Type) !== -1)
        .map(att => att.Name)
        .sort((a, b) => d3.ascending(a, b));
}

// JQuery method used to get data
var makeDataCall = function (url, type, data, successCallBack, errorCallBack) {
    return $.ajax({
        url: encodeURI(url),
        type: type,
        data: data,
        contentType: "application/json; charset=UTF-8",
        xhrFields: { withCredentials: true},
        success: successCallBack,
        error: errorCallBack
    });
};
